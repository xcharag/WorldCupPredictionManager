/**
 * Seed: importFootballDataKnockout.js
 *
 * One-off CLI wrapper around services/knockoutSync.js — creates/updates
 * Match documents for WC 2026 knockout-stage fixtures (Round of 32,
 * Round of 16, Quarter-Finals, Semi-Finals, Third-Place Play-off, Final)
 * imported from football-data.org.
 *
 * The same sync logic runs automatically every day at 05:00 UTC and right
 * after each match finishes (see services/scheduler.js) — run this script
 * manually only if you need an immediate one-off sync.
 *
 * Run: node src/seeds/importFootballDataKnockout.js
 *
 * Requires env vars: MONGODB_URI, FOOTBALL_DATA_API_KEY
 * Optional:          MONGODB_DB (default: worldcup2026)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { syncKnockoutBracket } = require('../services/knockoutSync');

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('[KO Seed] MONGODB_URI is not set');
    process.exit(1);
  }
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    console.error('[KO Seed] FOOTBALL_DATA_API_KEY is not set');
    process.exit(1);
  }

  const dbName = resolveDbName(process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`[KO Seed] Connected to MongoDB (${dbName})\n`);

  const result = await syncKnockoutBracket();
  console.log(`[KO Seed] ${result || 'No changes — bracket already up to date'}`);

  await mongoose.disconnect();
  console.log('\n[KO Seed] Done.');
}

run().catch((err) => {
  console.error('[KO Seed] Fatal:', err.message);
  process.exit(1);
});
