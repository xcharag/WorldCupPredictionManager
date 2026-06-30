/**
 * Scoring logic for match and tournament predictions.
 *
 * Match scoring:
 *   - Correct winner/draw: +2
 *   - Correct exact final result (both scores right): +1 bonus
 *   - One team score correct (only): +1 bonus
 *   - Both team scores correct: +2 bonus (replaces one-team bonus)
 *   Perfect = 2 + 1 + 2 = 5 points
 *
 *   Knockout draws: real knockout matches always need a winner, so when a user
 *   predicts a 90-min draw they also pick who wins in extra time/penalties.
 *   +3 bonus if that pick matches the match's actual winner — on top of the
 *   regular score points above (so a perfectly predicted knockout draw = 5 + 3 = 8).
 *
 * Tournament scoring:
 *   - Champion: +50
 *   - Runner-up: +30
 *   - Top scorer: +30
 *   - Top assister: +20
 *   - Most yellow cards: +20
 *   - Most red cards: +20
 */

const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Settings = require('../models/Settings');

function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function calcMatchPoints(predictedHome, predictedAway, actualHome, actualAway, predictedWinner, actualWinner) {
  let points = 0;

  const predictedOutcome = getOutcome(predictedHome, predictedAway);
  const actualOutcome = getOutcome(actualHome, actualAway);

  // +2 for correct outcome
  if (predictedOutcome === actualOutcome) points += 2;

  const homeCorrect = predictedHome === actualHome;
  const awayCorrect = predictedAway === actualAway;

  if (homeCorrect && awayCorrect) {
    points += 1; // +1 correct final result
    points += 2; // +2 correct both scores
  } else if (homeCorrect || awayCorrect) {
    points += 1; // +1 one team correct
  }

  // Knockout draw: +3 if the user predicted a draw AND the 90-min score was
  // also a draw AND their chosen winner matches the team that advanced.
  // actualHome === actualAway guards against applyFdUpdate setting match.winner
  // for regular-time wins, which would otherwise fire this bonus incorrectly.
  if (
    predictedHome === predictedAway &&
    actualHome === actualAway &&
    actualWinner &&
    predictedWinner === actualWinner
  ) {
    points += 3;
  }

  return points;
}

// Calculate & save points for all predictions of a finished match
async function calculateMatchPredictions(matchId) {
  const match = await Match.findById(matchId);
  if (!match || match.status !== 'finished' || match.homeScore == null || match.awayScore == null) {
    throw new Error('Match not finished or missing score');
  }

  const predictions = await MatchPrediction.find({ match: matchId });
  const updates = predictions.map((p) => {
    const pts = calcMatchPoints(
      p.predictedHomeScore, p.predictedAwayScore,
      match.homeScore, match.awayScore,
      p.predictedWinner, match.winner
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
