const cron = require('node-cron');
const Match = require('../models/Match');
const User = require('../models/User');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Settings = require('../models/Settings');
const MatchReminder = require('../models/MatchReminder');
const { sendMatchReminderEmail } = require('./email');
const fd = require('./footballdata');
const { calculateMatchPredictions } = require('./scoring');
const cl = require('./cronLogger');
const { sendDailyPushReminders, sendMatchStartPushReminders, sendGoalNotification } = require('./pushNotifications');

// How many minutes before/after the exact timing window we check.
// Cron runs every 5 min, so ±4 min window catches every match.
const WINDOW_MS = 4 * 60 * 1000;

const TIMINGS = [
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '6h',  ms:  6 * 60 * 60 * 1000 },
  { key: '4h',  ms:  4 * 60 * 60 * 1000 },
  { key: '1h',  ms:  1 * 60 * 60 * 1000 },
];

async function sendPendingReminders() {
  const now = Date.now();
  let sent = 0;

  for (const { key, ms } of TIMINGS) {
    const windowStart = new Date(now + ms - WINDOW_MS);
    const windowEnd   = new Date(now + ms + WINDOW_MS);

    // Find scheduled matches in the window for this timing
    const matches = await Match.find({
      status: 'scheduled',
      matchDate: { $gte: windowStart, $lte: windowEnd },
    }).populate('homeTeam', 'name flag').populate('awayTeam', 'name flag');

    if (!matches.length) continue;

    // Find users who want this timing and have a verified email
    const users = await User.find({
      notificationPreferences: key,
      isEmailVerified: true,
    }).select('email name notificationPreferences');

    for (const match of matches) {
      for (const user of users) {
        try {
          // insertOne with unique index will throw if already sent — skip duplicates
          await MatchReminder.create({ user: user._id, match: match._id, timing: key });
          await sendMatchReminderEmail(user, match, key);
          sent++;
        } catch (err) {
          if (err.code === 11000) continue; // duplicate — already sent
          console.error(`[Scheduler] Error sending ${key} reminder to ${user.email}:`, err.message);
        }
      }
    }
  }
  return sent > 0 ? `${sent} emails enviados` : null;
}

// ─── football-data.org status → app status ───────────────────────────────────
// TIMED = exact kickoff confirmed (still scheduled); POSTPONED/CANCELLED revert
// to scheduled so the proactive-promotion step can re-evaluate next run.
function mapFdStatus(apiStatus) {
  if (['IN_PLAY', 'PAUSED', 'LIVE', 'SUSPENDED'].includes(apiStatus)) return 'in_progress';
  if (['FINISHED', 'AWARDED'].includes(apiStatus)) return 'finished';
  return 'scheduled'; // SCHEDULED, TIMED, POSTPONED, CANCELLED
}

// ─── Position mapping (same as in the seed script) ───────────────────────────
const POSITION_MAP = {
  Goalkeeper:           'GK',
  Defence:              'DEF',
  'Centre-Back':        'DEF',
  'Left-Back':          'DEF',
  'Right-Back':         'DEF',
  Midfield:             'MID',
  'Central Midfield':   'MID',
  'Defensive Midfield': 'MID',
  'Attacking Midfield': 'MID',
  'Left Midfield':      'MID',
  'Right Midfield':     'MID',
  'Wide Midfield':      'MID',
  Offence:              'FWD',
  'Centre-Forward':     'FWD',
  'Left Winger':        'FWD',
  'Right Winger':       'FWD',
  'Second Striker':     'FWD',
};
const TLA_REMAP = { URY: 'URU', SAU: 'KSA', DRC: 'COD' };

function normPos(apiPos) { return POSITION_MAP[apiPos] || 'MID'; }

// ─── Live score polling ───────────────────────────────────────────────────────
// Called every 30 seconds. Strategy:
//   1. Promote any scheduled match past its start time → in_progress (time-based).
//   2. Bulk-fetch all currently live WC matches in one API call.
//   3. Update scores/status from the bulk response.
//   4. Individually poll in_progress matches absent from the live feed — they
//      may have just finished or been delayed (API will return SCHEDULED, reverting them).
// Rate: 1 bulk + 0-5 individual calls per run, well within 20 req/min.
let _syncRunning = false;

async function syncLiveMatches() {
  if (!process.env.FOOTBALL_DATA_API_KEY) return null;
  if (_syncRunning) return 'skipped (previous run still active)';
  _syncRunning = true;

  try {
    const now = new Date();

    // Step 1 — Promote scheduled matches that have passed their start time.
    // Individual polls below will revert any that were actually delayed.
    const { modifiedCount: promoted } = await Match.updateMany(
      { status: 'scheduled', matchDate: { $lte: now } },
      { $set: { status: 'in_progress' } }
    );
    if (promoted > 0) {
      console.log(`[Scheduler] Promoted ${promoted} match(es) to in_progress`);
    }

    // Step 2 — One bulk call for all live WC matches.
    let liveApiMatches = [];
    const liveIds = new Set();
    try {
      const data = await fd.getLiveWCMatches();
      liveApiMatches = data.matches || [];
      for (const m of liveApiMatches) liveIds.add(String(m.id));
    } catch (err) {
      console.error('[Scheduler] Bulk live-match fetch failed:', err.message);
    }

    let updated = 0;

    // Step 3 — Apply scores and status from the bulk response.
    for (const apiMatch of liveApiMatches) {
      const match = await Match.findOne({ footballDataId: String(apiMatch.id) })
        .populate('homeTeam', 'shortName')
        .populate('awayTeam', 'shortName');
      if (!match) continue;

      const newStatus = mapFdStatus(apiMatch.status);
      const score = apiMatch.score?.fullTime;
      const wasFinished = match.status === 'finished';
      const oldHome = match.homeScore;
      const oldAway = match.awayScore;

      match.status = newStatus;
      if (score?.home != null) match.homeScore = score.home;
      if (score?.away != null) match.awayScore = score.away;
      await match.save();
      updated++;

      // Notify on goal: score increased compared to what was stored
      if ((score?.home != null && score.home > (oldHome ?? -1)) ||
          (score?.away != null && score.away > (oldAway ?? -1))) {
        sendGoalNotification(match).catch(e =>
          console.error(`[Scheduler] Goal notification failed for match ${match._id}:`, e.message)
        );
      }

      if (!wasFinished && newStatus === 'finished') {
        try {
          await calculateMatchPredictions(match._id);
          console.log(`[Scheduler] Scored predictions for match ${match._id}`);
        } catch (e) {
          console.error(`[Scheduler] Scoring error for match ${match._id}:`, e.message);
        }
      }
    }

    // Step 4 — Individually poll in_progress matches not seen in the live feed.
    // This catches matches that just finished (dropped off the live feed) or were
    // time-promoted but are actually delayed/postponed on the API side.
    const inProgress = await Match.find({
      status: 'in_progress',
      footballDataId: { $exists: true, $ne: null },
    }).populate('homeTeam', 'shortName').populate('awayTeam', 'shortName');
    const stale = inProgress.filter(m => !liveIds.has(m.footballDataId));

    for (const match of stale) {
      try {
        const { match: apiMatch } = await fd.getMatch(match.footballDataId);
        const newStatus = mapFdStatus(apiMatch.status);
        const score = apiMatch.score?.fullTime;
        const wasFinished = match.status === 'finished';
        const oldHome = match.homeScore;
        const oldAway = match.awayScore;

        match.status = newStatus;
        if (score?.home != null) match.homeScore = score.home;
        if (score?.away != null) match.awayScore = score.away;
        await match.save();
        updated++;

        if ((score?.home != null && score.home > (oldHome ?? -1)) ||
            (score?.away != null && score.away > (oldAway ?? -1))) {
          sendGoalNotification(match).catch(e =>
            console.error(`[Scheduler] Goal notification failed for match ${match._id}:`, e.message)
          );
        }

        if (!wasFinished && newStatus === 'finished') {
          try {
            await calculateMatchPredictions(match._id);
            console.log(`[Scheduler] Scored predictions for match ${match._id}`);
          } catch (e) {
            console.error(`[Scheduler] Scoring error for match ${match._id}:`, e.message);
          }
        }
      } catch (err) {
        console.error(`[Scheduler] Individual update failed for match ${match._id}:`, err.message);
      }
    }

    const total = liveApiMatches.length + stale.length;
    if (total === 0 && promoted === 0) return null;
    return `${updated}/${total} partidos actualizados${promoted > 0 ? `, ${promoted} promovidos` : ''}`;
  } finally {
    _syncRunning = false;
  }
}

// ─── Team roster sync ─────────────────────────────────────────────────────────
// Called every hour. Re-fetches all 48 WC squads (1 API call) and upserts
// players so that late call-ups and substitutions stay current.
async function syncTeamRosters() {
  if (!process.env.FOOTBALL_DATA_API_KEY) return null;

  let updated = 0;
  try {
    const { teams } = await fd.getWCTeams();
    for (const apiTeam of teams) {
      const tla      = apiTeam.tla;
      const fifaCode = TLA_REMAP[tla] || tla;
      const dbTeam   = await Team.findOne({ fifaCode });
      if (!dbTeam) continue;

      for (const p of apiTeam.squad || []) {
        const playerUpdate = {
          name:     p.name,
          team:     dbTeam._id,
          position: normPos(p.position),
          isActive: true,
        };
        if (p.dateOfBirth) playerUpdate.dateOfBirth = new Date(p.dateOfBirth);

        await Player.findOneAndUpdate(
          { footballDataId: String(p.id) },
          { $set: playerUpdate },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        updated++;
      }
    }
    console.log(`[Scheduler] Roster sync complete — ${updated} players upserted`);
  } catch (err) {
    console.error('[Scheduler] Roster sync failed:', err.message);
    throw err;
  }
  return `${updated} jugadores sincronizados`;
}

// ─── Group standings sync ─────────────────────────────────────────────────────
// Fetches official WC standings from football-data.org, enriches with our DB
// team data (flag, badgeUrl), and stores the result in Settings('wcStandings').
// The API endpoint for users serves the cached value — no API call per request.
// On failure a single retry fires after 5 minutes; the next hourly run clears it.
let _standingsRetryTimer = null;

async function syncStandings() {
  if (!process.env.FOOTBALL_DATA_API_KEY) return null;

  if (_standingsRetryTimer) {
    clearTimeout(_standingsRetryTimer);
    _standingsRetryTimer = null;
  }

  try {
    const data = await fd.getWCStandings();
    const raw = data.standings || [];

    const result = {};
    for (const entry of raw) {
      // API may return "GROUP_A" or "Group A" depending on tier/season
      const letter = (entry.group || '').split(/[\s_]/).pop();
      if (!letter) continue;

      result[letter] = [];
      for (const row of entry.table || []) {
        const dbTeam = await Team.findOne({ footballDataId: String(row.team.id) })
          .select('name shortName flag badgeUrl').lean();

        result[letter].push({
          team: dbTeam || {
            name:      row.team.name,
            shortName: row.team.shortName || row.team.tla,
            flag:      '',
            badgeUrl:  null,
          },
          played:       row.playedGames,
          won:          row.won,
          drawn:        row.draw,      // API field is "draw"
          lost:         row.lost,
          goalsFor:     row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDiff:     row.goalDifference, // API field is "goalDifference"
          points:       row.points,
        });
      }
    }

    await Settings.set('wcStandings', { standings: result, updatedAt: new Date().toISOString() });
    console.log(`[Scheduler] Standings sync complete — ${Object.keys(result).length} groups`);
    return `${Object.keys(result).length} grupos actualizados`;
  } catch (err) {
    console.error('[Scheduler] Standings sync failed:', err.message);
    // Single retry 5 minutes after failure — avoids waiting a full hour
    if (!_standingsRetryTimer) {
      _standingsRetryTimer = setTimeout(() => {
        _standingsRetryTimer = null;
        syncStandings().catch(e =>
          console.error('[Scheduler] Standings retry failed:', e.message)
        );
      }, 5 * 60 * 1000);
    }
    throw err;
  }
}

function startScheduler() {
  // ── Register jobs with the logger ──────────────────────────────────────────
  cl.register('recordatorios',  '*/5 * * * *', 'Envía emails de recordatorio antes de partidos');
  cl.register('push-partidos',  '*/5 * * * *', 'Push notifications 1h/30min antes de partidos sin predecir');
  cl.register('marcadores',     '*/30 * * * * *', 'Sincroniza marcadores en vivo desde football-data.org');
  cl.register('plantillas',     '0 * * * *',   'Actualiza plantillas de equipos desde football-data.org');
  cl.register('posiciones',     '0 * * * *',   'Sincroniza posiciones del torneo desde football-data.org');
  cl.register('limpieza-logs',  '30 2 * * *',  'Elimina logs de MinIO con más de 7 días');
  cl.register('push-manana',    '0 11 * * *',  'Notificaciones push diarias (11:00 UTC)');
  cl.register('push-tarde',     '30 17 * * *', 'Notificaciones push diarias (17:30 UTC)');

  // ── Match reminders + push pre-match (every 5 min) ─────────────────────────
  cron.schedule('*/5 * * * *', cl.wrap('recordatorios', sendPendingReminders));
  cron.schedule('*/5 * * * *', cl.wrap('push-partidos', sendMatchStartPushReminders));
  console.log('[Scheduler] Match reminder crons started (every 5 min)');

  // ── Live score updates (every 30 s) ───────────────────────────────────────
  cron.schedule('*/30 * * * * *', cl.wrap('marcadores', syncLiveMatches));
  console.log('[Scheduler] Live-score cron started (every 30 s)');

  // ── Team roster refresh (every 1 hour) ─────────────────────────────────────
  cron.schedule('0 * * * *', cl.wrap('plantillas', syncTeamRosters));
  console.log('[Scheduler] Team-roster cron started (every 1 h)');

  // ── Group standings sync (every 1 hour, offset 5 min to spread API load) ───
  cron.schedule('5 * * * *', cl.wrap('posiciones', syncStandings));
  console.log('[Scheduler] Standings cron started (every 1 h)');
  // Warm the cache on startup so the first request never returns empty
  syncStandings().catch(e => console.warn('[Scheduler] Initial standings sync failed:', e.message));

  // ── Nightly log cleanup (02:30 UTC) ────────────────────────────────────────
  cron.schedule('30 2 * * *', cl.wrap('limpieza-logs', async () => {
    const n = await cl.cleanupOldLogs();
    return `${n} archivos eliminados`;
  }));
  console.log('[Scheduler] Log cleanup cron started (daily 02:30 UTC)');

  // ── Daily push notifications (11:00 and 17:30 UTC) ─────────────────────────
  // Adjust the UTC offset for your target timezone if needed.
  cron.schedule('0 11 * * *', cl.wrap('push-manana', sendDailyPushReminders));
  cron.schedule('30 17 * * *', cl.wrap('push-tarde', sendDailyPushReminders));
  console.log('[Scheduler] Daily push notification crons started (11:00 and 17:30 UTC)');
}

module.exports = { startScheduler };
