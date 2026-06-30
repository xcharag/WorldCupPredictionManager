/**
 * Scoring logic for match and tournament predictions.
 *
 * Default match scoring (all values configurable per group via scoringConfig):
 *   correctOutcome:      +2 for correct W/D/L
 *   oneTeamCorrect:      +1 when exactly one team's score matches
 *   exactScoreBonus:     +3 on top of correctOutcome when both scores match
 *                        → perfect score = 2 + 3 = 5 pts
 *   knockoutWinnerBonus: +3 when user predicted a 90-min draw AND picked the
 *                        correct team to advance (so a perfect knockout draw = 8 pts)
 *   extraTimeBonus:      +N if user predicted ET and match went to ET (default 0)
 *   penaltiesBonus:      +N if user predicted penalties and match went to pens (default 0)
 */

const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Settings = require('../models/Settings');

const DEFAULT_SCORING = {
  correctOutcome: 2,
  oneTeamCorrect: 1,
  exactScoreBonus: 3,
  knockoutWinnerBonus: 3,
  extraTimeBonus: 0,
  penaltiesBonus: 0,
};

function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Calculate points for a single prediction.
 * scoringConfig overrides individual fields from DEFAULT_SCORING.
 */
function calcMatchPoints(predictedHome, predictedAway, actualHome, actualAway, predictedWinner, actualWinner, scoringConfig = {}) {
  const cfg = { ...DEFAULT_SCORING, ...scoringConfig };
  let points = 0;

  const predictedOutcome = getOutcome(predictedHome, predictedAway);
  const actualOutcome = getOutcome(actualHome, actualAway);

  if (predictedOutcome === actualOutcome) points += cfg.correctOutcome;

  const homeCorrect = predictedHome === actualHome;
  const awayCorrect = predictedAway === actualAway;

  if (homeCorrect && awayCorrect) {
    points += cfg.exactScoreBonus;
  } else if (homeCorrect || awayCorrect) {
    points += cfg.oneTeamCorrect;
  }

  // Knockout draw bonus: only fires when user predicted a draw AND 90-min was a draw.
  // actualHome === actualAway guards against applyFdUpdate setting match.winner for regular wins.
  if (
    predictedHome === predictedAway &&
    actualHome === actualAway &&
    actualWinner &&
    predictedWinner === actualWinner
  ) {
    points += cfg.knockoutWinnerBonus;
  }

  return points;
}

// Calculate & save points for all predictions of a finished match.
// Uses the season's defaultScoringConfig as the canonical stored value.
// Groups with custom scoring compute their own totals at leaderboard time.
async function calculateMatchPredictions(matchId) {
  const Season = require('../models/Season');
  const match = await Match.findById(matchId).populate('season', 'defaultScoringConfig');
  if (!match || match.status !== 'finished' || match.homeScore == null || match.awayScore == null) {
    throw new Error('Match not finished or missing score');
  }

  const seasonCfg = match.season?.defaultScoringConfig || {};
  const predictions = await MatchPrediction.find({ match: matchId });
  const updates = predictions.map((p) => {
    const pts = calcMatchPoints(
      p.predictedHomeScore, p.predictedAwayScore,
      match.homeScore, match.awayScore,
      p.predictedWinner, match.winner,
      seasonCfg
    );
    return MatchPrediction.findByIdAndUpdate(p._id, { points: pts });
  });

  await Promise.all(updates);
  return predictions.length;
}

// Calculate tournament prediction points for all users in all groups
async function calculateTournamentPredictions() {
  const results = await Settings.get('tournamentResults');
  if (!results) throw new Error('Tournament results not set');

  const predictions = await TournamentPrediction.find();
  const updates = predictions.map((p) => {
    let pts = 0;
    if (results.champion && p.champion?.toString() === results.champion.toString()) pts += 50;
    if (results.runnerUp && p.runnerUp?.toString() === results.runnerUp.toString()) pts += 30;
    if (results.topScorer && p.topScorer?.toString() === results.topScorer.toString()) pts += 30;
    if (results.topAssister && p.topAssister?.toString() === results.topAssister.toString()) pts += 20;
    if (results.mostYellowCards && p.mostYellowCards?.toString() === results.mostYellowCards.toString()) pts += 20;
    if (results.mostRedCards && p.mostRedCards?.toString() === results.mostRedCards.toString()) pts += 20;
    return TournamentPrediction.findByIdAndUpdate(p._id, { points: pts });
  });

  await Promise.all(updates);
  return predictions.length;
}

module.exports = { calcMatchPoints, calculateMatchPredictions, calculateTournamentPredictions };
