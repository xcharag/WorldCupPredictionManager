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
const { syncKnockoutBracket } = require('./knockoutSync');
const cl = require('./cronLogger');
const { sendDailyPushReminders, sendMatchStartPushReminders, sendGoalNotification } = require('./pushNotifications');

// How many minutes before/after the exact timing window we check.
// Cron runs every 5 min, so ±4 min window catches every match.
const WINDOW_MS = 4 * 60 * 1000;

const FD_WINNER_MAP = { HOME_TEAM: 'home', AWAY_TEAM: 'away' };
const FD_DURATION_MAP = { REGULAR: 'regular_time', EXTRA_TIME: 'extra_time', PENALTY_SHOOTOUT: 'penalties' };

// Applies football-data.org's live state onto a match: clock, regulation score,
// extra-time/penalty scores (knockout only) and the final winner/decidedBy.
// Returns whether a real goal (regular time or extra time) was just scored, so
// the caller can fire a goal notification — penalty-shootout kicks don't count.
//
// API score field semantics (v4, WC 2026):
//   regularTime — goals in the first 90 min (null during live regular time)
//   extraTime   — goals scored only during extra time (not cumulative)
//   penalties   — goals in the penalty shootout only
//   fullTime    — TOTAL goals across all periods (reg + ET + pens) once finished;
//                 equals the live score during regular-time play (regularTime is null then)
//
// We store match.homeScore = 90-min score, and match.extraTimeHomeScore = cumulative
// score after ET (reg + ET), so the scoring engine and MatchCard both see the right numbers.
function applyFdUpdate(match, apiMatch) {
  const score = apiMatch.score || {};
  const fullTime = score.fullTime || {};
  const regularTime = score.regularTime || {};
  const extraTime = score.extraTime || {};
  const penalties = score.penalties || {};

  const oldLiveHome = match.extraTimeHomeScore ?? match.homeScore;
  const oldLiveAway = match.extraTimeAwayScore ?? match.awayScore;

  match.status = mapFdStatus(apiMatch.status);
  match.minute = apiMatch.minute ?? match.minute;
  match.injuryTime = apiMatch.injuryTime ?? match.injuryTime;

  // Use regularTime (pure 90-min score) when available; fall back to fullTime
  // only during live regular-time play, when regularTime is still null.
  const regHome = regularTime.home ?? fullTime.home;
  const regAway = regularTime.away ?? fullTime.away;
  if (regHome != null) match.homeScore = regHome;
  if (regAway != null) match.awayScore = regAway;

  // extraTime from the API = goals scored only during ET (not cumulative).
  // Store the cumulative (reg + ET) so MatchCard can display it correctly.
  if (extraTime.home != null && regHome != null) {
    match.extraTimeHomeScore = regHome + extraTime.home;
    match.extraTimeAwayScore = regAway + extraTime.away;
  }

  if (penalties.home != null) match.penaltyHomeScore = penalties.home;
  if (penalties.away != null) match.penaltyAwayScore = penalties.away;

  if (score.winner in FD_WINNER_MAP) match.winner = FD_WINNER_MAP[score.winner];
  if (score.duration in FD_DURATION_MAP) match.decidedBy = FD_DURATION_MAP[score.duration];

  // Goal notification: fire when the running score (cumulative through ET) increases.
  // Penalty kicks are excluded because extraTimeHomeScore is frozen once ET ends.
  const newLiveHome = match.extraTimeHomeScore ?? match.homeScore;
  const newLiveAway = match.extraTimeAwayScore ?? match.awayScore;
  return (newLiveHome != null && newLiveHome > (oldLiveHome ?? -1)) ||
         (newLiveAway != null && newLiveAway > (oldLiveAway ?? -1));
}

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

// Fire-and-forget knockout bracket resync, scheduled a few minutes after a
// match is scored as finished — football-data.org needs a little time to
// resolve TBD slots in the next round once the deciding result lands, so we
// don't query it the instant the match ends. Guarded so several matches
// finishing close together only schedule one pending sync.
const KNOCKOUT_SYNC_DELAY_MS = 5 * 60 * 1000;
let _knockoutSyncTimer = null;
function triggerKnockoutSync() {
  if (_knockoutSyncTimer) return;
  _knockoutSyncTimer = setTimeout(() => {
    _knockoutSyncTimer = null;
    syncKnockoutBracket()
      .then((result) => {
        if (result) console.log(`[Scheduler] Knockout bracket sync (post-match): ${result}`);
      })
      .catch((e) => console.error('[Scheduler] Post-match knockout sync failed:', e.message));
  }, KNOCKOUT_SYNC_DELAY_MS);
}

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

      const wasFinished = match.status === 'finished';
      const oldHome = match.homeScore;

      const goalScored = applyFdUpdate(match, apiMatch);
      const newStatus = match.status;
      await match.save();
      updated++;

      // Notify on goal (regular or extra time — penalty kicks don't count)
      if (goalScored) {
        sendGoalNotification(match).catch(e =>
          console.error(`[Scheduler] Goal notification failed for match ${match._id}:`, e.message)
        );
      }

      const scoresJustArrived = match.status === 'finished' && oldHome == null && match.homeScore != null;
      if ((!wasFinished && newStatus === 'finished') || scoresJustArrived) {
        try {
          await calculateMatchPredictions(match._id);
          console.log(`[Scheduler] Scored predictions for match ${match._id}`);
        } catch (e) {
          console.error(`[Scheduler] Scoring error for match ${match._id}:`, e.message);
        }
        triggerKnockoutSync();
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
        const apiMatch = await fd.getMatch(match.footballDataId);
        const wasFinished = match.status === 'finished';
        const oldHome = match.homeScore;

        const goalScored = applyFdUpdate(match, apiMatch);
        const newStatus = match.status;
        await match.save();
        updated++;

        if (goalScored) {
          sendGoalNotification(match).catch(e =>
            console.error(`[Scheduler] Goal notification failed for match ${match._id}:`, e.message)
          );
        }

        const scoresJustArrived = match.status === 'finished' && oldHome == null && match.homeScore != null;
        if ((!wasFinished && newStatus === 'finished') || scoresJustArrived) {
          try {
            await calculateMatchPredictions(match._id);
            console.log(`[Scheduler] Scored predictions for match ${match._id}`);
          } catch (e) {
            console.error(`[Scheduler] Scoring error for match ${match._id}:`, e.message);
          }
          triggerKnockoutSync();
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
  cl.register('bracket-knockout', '0 5 * * *', 'Sincroniza equipos resueltos del cuadro eliminatorio desde football-data.org');
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

  // ── Knockout bracket sync (daily 05:00 UTC) ────────────────────────────────
  // Catches any bracket resolution missed by the post-match trigger (API lag,
  // restarts, etc). Also runs immediately after each match finishes — see
  // triggerKnockoutSync() in syncLiveMatches above.
  cron.schedule('0 5 * * *', cl.wrap('bracket-knockout', syncKnockoutBracket));
  console.log('[Scheduler] Knockout bracket cron started (daily 05:00 UTC)');

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
