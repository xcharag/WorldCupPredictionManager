/**
 * cronLogger.js
 *
 * Wraps cron job functions with:
 *  - In-memory registry  (status, last run, next run)
 *  - In-memory storage of the most recent run (1 per job)
 *  - MinIO persistence for errors only
 *  - Nightly cleanup of MinIO log files older than 7 days
 *
 * Usage:
 *   const cl = require('./cronLogger');
 *   cl.register('liveScore', '* * * * *', 'Actualiza marcadores en vivo');
 *   cron.schedule('* * * * *', cl.wrap('liveScore', syncLiveMatches));
 */

const { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const minioClient = require('../config/minio');

const BUCKET      = process.env.MINIO_BUCKET || 'worldcup2026';
const LOG_PREFIX  = 'logs/cron/';

// ── In-memory state ────────────────────────────────────────────────────────────
const registry = {};   // { name → JobDef }
const ringBuf  = {};   // { name → LogEntry[] }

// ── Human-readable schedule strings ───────────────────────────────────────────
function humanSchedule(expr) {
  if (expr === '* * * * *')    return 'Cada minuto';
  if (expr === '*/5 * * * *')  return 'Cada 5 min';
  if (expr === '*/15 * * * *') return 'Cada 15 min';
  if (expr === '0 * * * *')    return 'Cada hora';
  if (expr === '0 2 * * *')    return 'Diario 02:00 UTC';
  if (expr === '30 2 * * *')   return 'Diario 02:30 UTC';
  return expr;
}

// ── Next-run calculator (handles the patterns we use) ─────────────────────────
function nextRun(expr) {
  const now  = new Date();
  const secs = now.getSeconds() * 1000 + now.getMilliseconds();
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minP, hourP] = parts;

  // every minute
  if (expr === '* * * * *') {
    return new Date(now.getTime() + (60000 - secs));
  }
  // every N minutes
  const stepM = minP.match(/^\*\/(\d+)$/);
  if (stepM && hourP === '*') {
    const n   = Number(stepM[1]);
    const cur = now.getMinutes();
    const nxt = Math.ceil((cur + 1) / n) * n;
    const d   = new Date(now);
    if (nxt >= 60) { d.setHours(d.getHours() + 1, 0, 0, 0); }
    else           { d.setMinutes(nxt, 0, 0); }
    return d;
  }
  // at minute 0 of every hour
  if (minP === '0' && hourP === '*') {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    if (d <= now) d.setHours(d.getHours() + 1);
    return d;
  }
  // daily at HH:MM
  const hourN = Number(hourP), minN = Number(minP);
  if (!isNaN(hourN) && !isNaN(minN)) {
    const d = new Date(now);
    d.setHours(hourN, minN, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Register a cron job definition.
 * @param {string} name       Unique job identifier
 * @param {string} cronExpr   Cron expression (5-field)
 * @param {string} description Human-readable description
 */
function register(name, cronExpr, description) {
  registry[name] = {
    name,
    cronExpr,
    scheduleLabel: humanSchedule(cronExpr),
    description,
    status:  'idle',   // 'idle' | 'running' | 'error'
    running: false,
    lastRun: null,
    runCount: 0,
  };
  ringBuf[name] = [];
}

/**
 * Wrap a cron job function with logging.
 * The wrapped function:
 *  - Updates registry state (running / idle / error)
 *  - Appends to the in-memory ring buffer
 *  - Persists to MinIO when the run was non-trivial (or was an error)
 *
 * @param {string}   name  Registered job name
 * @param {Function} fn    Async job function (may return any value)
 * @returns {Function}     New async function to pass to cron.schedule()
 */
function wrap(name, fn) {
  return async function () {
    const job = registry[name];
    if (job) { job.running = true; job.status = 'running'; }

    const startedAt = new Date();
    const entry = {
      job:         name,
      startedAt:   startedAt.toISOString(),
      finishedAt:  null,
      durationMs:  null,
      status:      'running',
      result:      null,
      error:       null,
    };

    try {
      const ret = await fn();
      const finishedAt = new Date();
      entry.finishedAt = finishedAt.toISOString();
      entry.durationMs = finishedAt - startedAt;
      entry.status     = 'success';
      entry.result     = ret != null ? String(ret) : null;

      if (job) {
        job.status  = 'idle';
        job.lastRun = entry;
        job.runCount++;
      }
    } catch (err) {
      const finishedAt = new Date();
      entry.finishedAt = finishedAt.toISOString();
      entry.durationMs = finishedAt - startedAt;
      entry.status     = 'error';
      entry.error      = err.message;

      if (job) {
        job.status  = 'error';
        job.lastRun = entry;
        job.runCount++;
      }
      // Don't re-throw — cron layer already logs it
    } finally {
      if (job) job.running = false;

      // Keep only the latest run in memory (overwrite previous)
      ringBuf[name] = [entry];

      // MinIO: only persist errors
      const shouldPersist = entry.status === 'error';
      if (shouldPersist && process.env.MINIO_ENDPOINT) {
        persistLog(entry).catch(e =>
          console.error('[CronLogger] MinIO write failed:', e.message)
        );
      }
    }
  };
}

// ── MinIO helpers ──────────────────────────────────────────────────────────────

async function persistLog(entry) {
  const date = entry.startedAt.slice(0, 10);
  const ts   = entry.startedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const key  = `${LOG_PREFIX}${entry.job}/${date}/${ts}.json`;

  await minioClient.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        JSON.stringify(entry, null, 2),
    ContentType: 'application/json',
  }));
}

/**
 * List recent log entries from MinIO for a specific job (or all jobs).
 * Used by the admin API to load historical logs beyond the in-memory buffer.
 * @param {string|null} jobName
 * @param {number}      limit
 * @returns {Promise<LogEntry[]>}
 */
async function loadMinioLogs(jobName, limit = 50) {
  if (!process.env.MINIO_ENDPOINT) return [];
  try {
    const prefix = jobName ? `${LOG_PREFIX}${jobName}/` : LOG_PREFIX;
    const listed = await minioClient.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: Math.min(limit * 2, 200),
    }));

    const objects = (listed.Contents || [])
      .sort((a, b) => b.LastModified - a.LastModified)
      .slice(0, limit);

    const entries = await Promise.all(
      objects.map(async obj => {
        try {
          const { GetObjectCommand } = require('@aws-sdk/client-s3');
          const res  = await minioClient.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
          const body = await streamToString(res.Body);
          return JSON.parse(body);
        } catch { return null; }
      })
    );

    return entries.filter(Boolean);
  } catch (err) {
    console.error('[CronLogger] MinIO list error:', err.message);
    return [];
  }
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/**
 * Delete MinIO log files older than 7 days.
 * Call this from a nightly cron.
 */
async function cleanupOldLogs() {
  if (!process.env.MINIO_ENDPOINT) return 0;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let deleted = 0;

  try {
    let continuationToken;
    do {
      const params = { Bucket: BUCKET, Prefix: LOG_PREFIX, MaxKeys: 1000 };
      if (continuationToken) params.ContinuationToken = continuationToken;

      const res = await minioClient.send(new ListObjectsV2Command(params));
      const stale = (res.Contents || []).filter(o => o.LastModified < cutoff);

      await Promise.all(
        stale.map(o =>
          minioClient.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: o.Key }))
            .then(() => deleted++)
            .catch(() => {})
        )
      );

      continuationToken = res.IsTruncated ? res.NextContinuationToken : null;
    } while (continuationToken);
  } catch (err) {
    console.error('[CronLogger] Cleanup error:', err.message);
  }

  return deleted;
}

// ── Read API ───────────────────────────────────────────────────────────────────

/**
 * Returns all registered jobs with current status + next run time.
 */
function getJobs() {
  return Object.values(registry).map(j => ({
    ...j,
    nextRun: nextRun(j.cronExpr)?.toISOString() ?? null,
  }));
}

/**
 * Returns in-memory logs (fast).
 * @param {string|null} jobName  Filter by job name, or null for all
 * @param {number}      limit
 */
function getMemoryLogs(jobName, limit = 50) {
  if (jobName) {
    return (ringBuf[jobName] || []).slice(0, limit);
  }
  const all = Object.values(ringBuf).flat();
  all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return all.slice(0, limit);
}

module.exports = { register, wrap, getJobs, getMemoryLogs, loadMinioLogs, cleanupOldLogs };
