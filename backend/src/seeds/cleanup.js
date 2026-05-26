/**
 * Cleanup script: removes transient tournament data while keeping
 * users, teams and players.
 *
 * Run: node src/seeds/cleanup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Group = require('../models/Group');
const Settings = require('../models/Settings');

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function cleanup() {
  const dbName = resolveDbName(process.env.MONGODB_URI || '');
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  const [matches, matchPredictions, tournamentPredictions, groups, settings] = await Promise.all([
    Match.deleteMany({}),
    MatchPrediction.deleteMany({}),
    TournamentPrediction.deleteMany({}),
    Group.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  console.log('\nCleanup completed (users, teams and players were preserved):');
  console.log(`  Matches deleted: ${matches.deletedCount}`);
  console.log(`  Match predictions deleted: ${matchPredictions.deletedCount}`);
  console.log(`  Tournament predictions deleted: ${tournamentPredictions.deletedCount}`);
  console.log(`  Groups deleted: ${groups.deletedCount}`);
  console.log(`  Settings deleted: ${settings.deletedCount}`);

  await mongoose.disconnect();
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
