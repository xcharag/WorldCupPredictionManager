const cron = require('node-cron');
const Match = require('../models/Match');
const User = require('../models/User');
const MatchReminder = require('../models/MatchReminder');
const { sendMatchReminderEmail } = require('./email');

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
        } catch (err) {
          if (err.code === 11000) continue; // duplicate — already sent
          console.error(`[Scheduler] Error sending ${key} reminder to ${user.email}:`, err.message);
        }
      }
    }
  }
}

function startScheduler() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendPendingReminders();
    } catch (err) {
      console.error('[Scheduler] Unexpected error:', err.message);
    }
  });
  console.log('[Scheduler] Match reminder cron started (every 5 min)');
}

module.exports = { startScheduler };
