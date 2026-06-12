const webpush = require('web-push');
const User = require('../models/User');
const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
const MatchReminder = require('../models/MatchReminder');
const TournamentPrediction = require('../models/TournamentPrediction');
const Settings = require('../models/Settings');

const TOURNAMENT_FIELDS = ['champion', 'runnerUp', 'topScorer', 'topAssister', 'mostYellowCards', 'mostRedCards'];

// Timing windows — same values as email reminders so users can mix/match channels
const REMINDER_TIMINGS = {
  '24h': 24 * 60 * 60 * 1000,
  '6h':   6 * 60 * 60 * 1000,
  '4h':   4 * 60 * 60 * 1000,
  '1h':   1 * 60 * 60 * 1000,
};
const WINDOW_MS = 4 * 60 * 1000; // ±4 min — cron runs every 5 min

// Initialise web-push lazily so the server still starts if VAPID keys are not
// set (development without .env configured).
function initWebPush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@worldcup2026.app'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    return true;
  } catch (err) {
    console.error('[Push] Failed to initialise web-push:', err.message);
    return false;
  }
}

/** Format milliseconds to "2h 30min" or "45min". */
function formatTimeRemaining(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${totalMinutes}min`;
}

/**
 * Send a push notification to all active subscriptions of a user.
 * Automatically removes expired/invalid subscriptions (HTTP 410/404).
 */
async function sendPushToUser(user, payload) {
  if (!initWebPush()) return;
  const dead = [];
  for (const sub of user.pushSubscriptions || []) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        dead.push(sub.endpoint);
      } else {
        console.error(`[Push] sendNotification error for user ${user._id}:`, err.message);
      }
    }
  }
  if (dead.length) {
    await User.findByIdAndUpdate(user._id, {
      $pull: { pushSubscriptions: { endpoint: { $in: dead } } },
    });
  }
}

/**
 * Called at 11:00 and 17:30 UTC.
 * Sends up to TWO separate notifications per user:
 *   1. Pending match predictions — highlights the next upcoming match.
 *   2. Incomplete tournament predictions — separate notification.
 */
async function sendDailyPushReminders() {
  if (!initWebPush()) return null;

  const users = await User.find({
    pushNotificationsEnabled: true,
    pushSubscriptions: { $exists: true, $not: { $size: 0 } },
  }).select('_id pushSubscriptions');

  if (!users.length) return null;

  const now = Date.now();
  const tournamentLocked = await Settings.get('tournamentLocked', false);

  // Pre-fetch all future scheduled matches sorted by date — shared across users
  const scheduledMatches = await Match.find({
    status: 'scheduled',
    matchDate: { $gt: now },
  })
    .sort({ matchDate: 1 })
    .populate('homeTeam', 'shortName')
    .populate('awayTeam', 'shortName')
    .lean();

  let sent = 0;

  for (const user of users) {
    try {
      // ── Pending match predictions ─────────────────────────────────────────
      const predictedIds = await MatchPrediction.find({ user: user._id }).distinct('match');
      const predictedSet = new Set(predictedIds.map(String));
      const unpredicted = scheduledMatches.filter((m) => !predictedSet.has(String(m._id)));

      if (unpredicted.length > 0) {
        const next = unpredicted[0];
        const msUntil = new Date(next.matchDate).getTime() - now;
        const home = next.homeTeam?.shortName || '?';
        const away = next.awayTeam?.shortName || '?';
        const timeStr = formatTimeRemaining(msUntil);

        let body = `El partido empieza en ${timeStr}`;
        if (unpredicted.length > 1) {
          body += ` · ${unpredicted.length - 1} partido${unpredicted.length - 1 === 1 ? '' : 's'} más sin predecir`;
        }

        await sendPushToUser(user, {
          title: `⚽ Poné tu predicción: ${home} vs ${away}`,
          body,
          url: '/matches?filter=unpredicted',
        });
        sent++;
      }

      // ── Pending tournament predictions ────────────────────────────────────
      if (!tournamentLocked) {
        const tPred = await TournamentPrediction.findOne({ user: user._id, group: null }).lean();
        const missing = tPred ? TOURNAMENT_FIELDS.filter((f) => !tPred[f]).length : 6;
        if (missing > 0) {
          await sendPushToUser(user, {
            title: '🏆 Pronósticos del torneo incompletos',
            body: `Te faltan ${missing} pronóstico${missing === 1 ? '' : 's'}. ¡Completalos antes de que empiece el Mundial!`,
            url: '/tournament',
          });
          sent++;
        }
      }
    } catch (err) {
      console.error(`[Push] Error processing user ${user._id}:`, err.message);
    }
  }

  return sent > 0 ? `${sent} push enviados` : null;
}

/**
 * Called every 5 minutes.
 * Sends push notifications to users who haven't predicted a match that is
 * about to start, using each user's own pushReminderPreferences timings
 * (24h / 6h / 4h / 1h). Only fires for users who have push enabled.
 * Uses MatchReminder for deduplication (timing keys: push-24h … push-1h).
 */
async function sendMatchStartPushReminders() {
  if (!initWebPush()) return null;

  const now = Date.now();
  let sent = 0;

  for (const [timing, ms] of Object.entries(REMINDER_TIMINGS)) {
    const pushKey = `push-${timing}`;
    const windowStart = new Date(now + ms - WINDOW_MS);
    const windowEnd   = new Date(now + ms + WINDOW_MS);

    const matches = await Match.find({
      status: 'scheduled',
      matchDate: { $gte: windowStart, $lte: windowEnd },
    })
      .populate('homeTeam', 'shortName')
      .populate('awayTeam', 'shortName')
      .lean();

    if (!matches.length) continue;

    // Only users who have push enabled AND selected this timing
    const users = await User.find({
      pushNotificationsEnabled: true,
      pushSubscriptions: { $exists: true, $not: { $size: 0 } },
      pushReminderPreferences: timing,
    }).select('_id pushSubscriptions');

    if (!users.length) continue;

    for (const match of matches) {
      const predictedUserIds = await MatchPrediction.find({ match: match._id }).distinct('user');
      const predictedSet = new Set(predictedUserIds.map(String));

      const home = match.homeTeam?.shortName || '?';
      const away = match.awayTeam?.shortName || '?';
      const msUntil = new Date(match.matchDate).getTime() - now;
      const timeStr = formatTimeRemaining(Math.max(0, msUntil));

      for (const user of users) {
        if (predictedSet.has(String(user._id))) continue; // already predicted

        try {
          // Deduplicate: throws 11000 if already sent for this user+match+timing
          await MatchReminder.create({ user: user._id, match: match._id, timing: pushKey });
          await sendPushToUser(user, {
            title: `⚽ ${home} vs ${away} — empieza en ${timeStr}`,
            body: `¡Todavía no pusiste tu predicción!`,
            url: '/matches',
          });
          sent++;
        } catch (err) {
          if (err.code === 11000) continue; // already sent
          console.error(`[Push] Match-start push error (user ${user._id}):`, err.message);
        }
      }
    }
  }

  return sent > 0 ? `${sent} push de partido enviados` : null;
}

/**
 * Called when a goal is scored during a live match.
 * Notifies all users who have push subscriptions enabled.
 * `match` must have homeTeam/awayTeam populated (shortName).
 */
async function sendGoalNotification(match) {
  if (!initWebPush()) return;

  const home = match.homeTeam?.shortName || '?';
  const away = match.awayTeam?.shortName || '?';
  const scoreStr = `${match.homeScore ?? 0}–${match.awayScore ?? 0}`;

  const users = await User.find({
    pushNotificationsEnabled: true,
    pushSubscriptions: { $exists: true, $not: { $size: 0 } },
  }).select('_id pushSubscriptions');

  for (const user of users) {
    try {
      await sendPushToUser(user, {
        title: `⚽ ¡Gooool! ${home} ${scoreStr} ${away}`,
        body: 'El marcador ha cambiado',
        url: '/matches',
      });
    } catch (err) {
      console.error(`[Push] Goal notification error for user ${user._id}:`, err.message);
    }
  }
}

module.exports = { sendPushToUser, sendDailyPushReminders, sendMatchStartPushReminders, sendGoalNotification };
