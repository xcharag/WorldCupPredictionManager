const cron = require('node-cron');
const Match = require('../models/Match');
const User = require('../models/User');
const Player = require('../models/Player');
const Team = require('../models/Team');
const MatchReminder = require('../models/MatchReminder');
const { sendMatchReminderEmail } = require('./email');
const fd = require('./footballdata');
const { calculateMatchPredictions } = require('./scoring');
const cl = require('./cronLogger');

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
function mapFdStatus(apiStatus) {
  if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(apiStatus)) return 'in_progress';
  if (apiStatus === 'FINISHED') return 'finished';
  return 'scheduled';
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
// Called every minute. Finds matches that are live or just started, then calls
// the football-data.org /matches/:id endpoint for each and updates MongoDB.
// API calls are naturally throttled by the 6.2 s delay in footballdata.js.
async function syncLiveMatches() {
  if (!process.env.FOOTBALL_DATA_API_KEY) return null;

  const now = new Date();
  const recentStart = new Date(now.getTime() - 15 * 60 * 1000);

  const candidates = await Match.find({
    footballDataId: { $exists: true, $ne: null },
    $or: [
      { status: 'in_progress' },
      { status: 'scheduled', matchDate: { $lte: now, $gte: recentStart } },
    ],
  });

  if (!candidates.length) return null;

  let updated = 0;
  for (const match of candidates) {
    try {
      const { match: apiMatch } = await fd.getMatch(match.footballDataId);
      const newStatus = mapFdStatus(apiMatch.status);
      const score = apiMatch.score?.fullTime;

      const wasFinished = match.status === 'finished';

      match.status = newStatus;
      if (score) {
        if (score.home !== null) match.homeScore = score.home;
        if (score.away !== null) match.awayScore = score.away;
      }
      await match.save();
      updated++;

      // Trigger prediction scoring when a match transitions to finished
      if (!wasFinished && newStatus === 'finished') {
        try {
          await calculateMatchPredictions(match._id);
          console.log(`[Scheduler] Scored predictions for match ${match._id}`);
        } catch (scoringErr) {
          console.error(`[Scheduler] Scoring error for match ${match._id}:`, scoringErr.message);
        }
      }
    } catch (err) {
      console.error(`[Scheduler] Live update failed for match ${match._id}:`, err.message);
    }
  }
  return updated > 0 ? `${updated}/${candidates.length} partidos actualizados` : null;
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

function startScheduler() {
  // ── Register jobs with the logger ──────────────────────────────────────────
  cl.register('recordatorios',  '*/5 * * * *', 'Envía emails de recordatorio antes de partidos');
  cl.register('marcadores',     '* * * * *',   'Sincroniza marcadores en vivo desde football-data.org');
  cl.register('plantillas',     '0 * * * *',   'Actualiza plantillas de equipos desde football-data.org');
  cl.register('limpieza-logs',  '30 2 * * *',  'Elimina logs de MinIO con más de 7 días');

  // ── Match reminders (every 5 min) ──────────────────────────────────────────
  cron.schedule('*/5 * * * *', cl.wrap('recordatorios', sendPendingReminders));
  console.log('[Scheduler] Match reminder cron started (every 5 min)');

  // ── Live score updates (every 1 min) ───────────────────────────────────────
  cron.schedule('* * * * *', cl.wrap('marcadores', syncLiveMatches));
  console.log('[Scheduler] Live-score cron started (every 1 min)');

  // ── Team roster refresh (every 1 hour) ─────────────────────────────────────
  cron.schedule('0 * * * *', cl.wrap('plantillas', syncTeamRosters));
  console.log('[Scheduler] Team-roster cron started (every 1 h)');

  // ── Nightly log cleanup (02:30 UTC) ────────────────────────────────────────
  cron.schedule('30 2 * * *', cl.wrap('limpieza-logs', async () => {
    const n = await cl.cleanupOldLogs();
    return `${n} archivos eliminados`;
  }));
  console.log('[Scheduler] Log cleanup cron started (daily 02:30 UTC)');
}

module.exports = { startScheduler };
