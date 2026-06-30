/**
 * One-time fix script: optionally re-syncs match scores from football-data.org,
 * then recalculates prediction points for all finished knockout-stage matches
 * using the corrected scoring logic.
 *
 * Run:
 *   node src/seeds/recalculateKnockoutPoints.js              # recalculate points only
 *   node src/seeds/recalculateKnockoutPoints.js --resync     # fix match scores first, then recalculate
 *   node src/seeds/recalculateKnockoutPoints.js --dry-run    # preview without writing
 *   node src/seeds/recalculateKnockoutPoints.js --match <id> # single match
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
require('../models/Team');
const { calcMatchPoints } = require('../services/scoring');
const fd = require('../services/footballdata');

const DRY_RUN = process.argv.includes('--dry-run');
const RESYNC = process.argv.includes('--resync');
const SINGLE_MATCH = (() => {
  const idx = process.argv.indexOf('--match');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const KNOCKOUT_STAGES = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final'];

const FD_WINNER_MAP = { HOME_TEAM: 'home', AWAY_TEAM: 'away' };
const FD_DURATION_MAP = { REGULAR: 'regular_time', EXTRA_TIME: 'extra_time', PENALTY_SHOOTOUT: 'penalties' };

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

// Same logic as scheduler.js applyFdUpdate — keep in sync if that changes.
function extractScores(apiMatch) {
  const score = apiMatch.score || {};
  const fullTime = score.fullTime || {};
  const regularTime = score.regularTime || {};
  const extraTime = score.extraTime || {};
  const penalties = score.penalties || {};

  const regHome = regularTime.home ?? fullTime.home;
  const regAway = regularTime.away ?? fullTime.away;

  return {
    homeScore: regHome ?? null,
    awayScore: regAway ?? null,
    extraTimeHomeScore: (extraTime.home != null && regHome != null) ? regHome + extraTime.home : null,
    extraTimeAwayScore: (extraTime.away != null && regAway != null) ? regAway + extraTime.away : null,
    penaltyHomeScore: penalties.home ?? null,
    penaltyAwayScore: penalties.away ?? null,
    winner: FD_WINNER_MAP[score.winner] ?? null,
    decidedBy: FD_DURATION_MAP[score.duration] ?? null,
  };
}

async function resyncMatchScore(match) {
  if (!match.footballDataId) {
    console.log(`  [skip resync] No footballDataId`);
    return false;
  }

  const apiMatch = await fd.getMatch(match.footballDataId);
  const s = extractScores(apiMatch);

  const changed =
    match.homeScore !== s.homeScore ||
    match.awayScore !== s.awayScore ||
    match.extraTimeHomeScore !== s.extraTimeHomeScore ||
    match.extraTimeAwayScore !== s.extraTimeAwayScore ||
    match.penaltyHomeScore !== s.penaltyHomeScore ||
    match.penaltyAwayScore !== s.penaltyAwayScore ||
    match.winner !== s.winner ||
    match.decidedBy !== s.decidedBy;

  if (!changed) return false;

  console.log(
    `  [resync] homeScore ${match.homeScore}→${s.homeScore}` +
    `  awayScore ${match.awayScore}→${s.awayScore}` +
    (s.extraTimeHomeScore != null ? `  aet ${s.extraTimeHomeScore}-${s.extraTimeAwayScore}` : '') +
    (s.penaltyHomeScore != null ? `  pen ${s.penaltyHomeScore}-${s.penaltyAwayScore}` : '') +
    (s.winner ? `  winner=${s.winner} by=${s.decidedBy}` : '')
  );

  // Always update in-memory so downstream scoring uses corrected values,
  // even in dry-run mode (only the DB write is skipped).
  match.homeScore = s.homeScore;
  match.awayScore = s.awayScore;
  match.extraTimeHomeScore = s.extraTimeHomeScore;
  match.extraTimeAwayScore = s.extraTimeAwayScore;
  match.penaltyHomeScore = s.penaltyHomeScore;
  match.penaltyAwayScore = s.penaltyAwayScore;
  match.winner = s.winner;
  match.decidedBy = s.decidedBy;

  if (!DRY_RUN) {
    await Match.findByIdAndUpdate(match._id, {
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      extraTimeHomeScore: s.extraTimeHomeScore,
      extraTimeAwayScore: s.extraTimeAwayScore,
      penaltyHomeScore: s.penaltyHomeScore,
      penaltyAwayScore: s.penaltyAwayScore,
      winner: s.winner,
      decidedBy: s.decidedBy,
    });
  }

  return true;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  if (RESYNC && !process.env.FOOTBALL_DATA_API_KEY) throw new Error('FOOTBALL_DATA_API_KEY not set (required for --resync)');

  await mongoose.connect(uri, { dbName: resolveDbName(uri) });
  console.log(`Connected to MongoDB${DRY_RUN ? ' (DRY RUN — no writes)' : ''}${RESYNC ? ' + resync from API' : ''}\n`);

  const matchQuery = SINGLE_MATCH
    ? { _id: SINGLE_MATCH, status: 'finished' }
    : { stage: { $in: KNOCKOUT_STAGES }, status: 'finished', homeScore: { $ne: null }, awayScore: { $ne: null } };

  const matches = await Match.find(matchQuery)
    .populate('homeTeam', 'shortName')
    .populate('awayTeam', 'shortName')
    .sort({ matchDate: 1 });

  console.log(`Found ${matches.length} finished knockout match(es) to process.\n`);

  let totalPredictions = 0;
  let totalChanged = 0;
  let matchesResynced = 0;

  for (const match of matches) {
    const home = match.homeTeam?.shortName ?? '?';
    const away = match.awayTeam?.shortName ?? '?';
    const scoreLine = `${match.homeScore}-${match.awayScore}`;
    const winnerInfo = match.winner ? ` (winner: ${match.winner}, by: ${match.decidedBy ?? '?'})` : '';
    console.log(`[${match.stage}] ${home} vs ${away}  ${scoreLine}${winnerInfo}`);

    if (RESYNC) {
      const resynced = await resyncMatchScore(match);
      if (resynced) matchesResynced++;
    }

    const predictions = await MatchPrediction.find({ match: match._id });
    if (!predictions.length) {
      console.log('  No predictions — skipping.\n');
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
  if (RESYNC) console.log(`Match scores resynced from API: ${matchesResynced}`);
  console.log(`Predictions checked: ${totalPredictions}, corrected: ${totalChanged}`);
  if (DRY_RUN) console.log('(DRY RUN — no changes written to database)');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
