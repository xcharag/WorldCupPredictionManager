/**
 * One-time fix script: recalculates match prediction points for all finished
 * knockout-stage matches using the corrected scoring logic.
 *
 * Run: node src/seeds/recalculateKnockoutPoints.js
 *
 * Use --dry-run to preview changes without writing to the DB.
 * Use --match <id> to target a single match.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
require('../models/Team'); // register schema so populate works
const { calcMatchPoints } = require('../services/scoring');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_MATCH = (() => {
  const idx = process.argv.indexOf('--match');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const KNOCKOUT_STAGES = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final'];

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
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri, { dbName: resolveDbName(uri) });
  console.log(`Connected to MongoDB${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);

  const matchQuery = SINGLE_MATCH
    ? { _id: SINGLE_MATCH, status: 'finished' }
    : { stage: { $in: KNOCKOUT_STAGES }, status: 'finished', homeScore: { $ne: null }, awayScore: { $ne: null } };

  const matches = await Match.find(matchQuery)
    .populate('homeTeam', 'shortName')
    .populate('awayTeam', 'shortName')
    .sort({ matchDate: 1 });

  console.log(`\nFound ${matches.length} finished knockout match(es) to process.\n`);

  let totalPredictions = 0;
  let totalChanged = 0;

  for (const match of matches) {
    const home = match.homeTeam?.shortName ?? '?';
    const away = match.awayTeam?.shortName ?? '?';
    const scoreLine = `${match.homeScore}-${match.awayScore}`;
    const winnerInfo = match.winner ? ` (winner: ${match.winner}, by: ${match.decidedBy ?? '?'})` : '';
    console.log(`[${match.stage}] ${home} vs ${away}  ${scoreLine}${winnerInfo}`);

    const predictions = await MatchPrediction.find({ match: match._id });
    if (!predictions.length) {
      console.log('  No predictions — skipping.');
      continue;
    }

    let matchChanged = 0;
    const writes = [];

    for (const p of predictions) {
      const oldPoints = p.points;
      const newPoints = calcMatchPoints(
        p.predictedHomeScore,
        p.predictedAwayScore,
        match.homeScore,
        match.awayScore,
        p.predictedWinner,
        match.winner
      );

      if (oldPoints !== newPoints) {
        console.log(
          `  user=${p.user}  predicted=${p.predictedHomeScore}-${p.predictedAwayScore}` +
          (p.predictedWinner ? ` winner=${p.predictedWinner}` : '') +
          `  OLD=${oldPoints ?? 'null'}  NEW=${newPoints}`
        );
        matchChanged++;
        if (!DRY_RUN) {
          writes.push(MatchPrediction.findByIdAndUpdate(p._id, { points: newPoints }));
        }
      }
    }

    if (!DRY_RUN && writes.length) await Promise.all(writes);

    totalPredictions += predictions.length;
    totalChanged += matchChanged;
    console.log(`  ${predictions.length} predictions checked, ${matchChanged} changed.\n`);
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${totalPredictions} predictions checked, ${totalChanged} corrected.`);
  if (DRY_RUN) console.log('(DRY RUN — no changes written to database)');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
