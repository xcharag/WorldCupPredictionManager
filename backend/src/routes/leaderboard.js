const express = require('express');
const router = express.Router();
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Group = require('../models/Group');
const Season = require('../models/Season');
const User = require('../models/User');
const { calcMatchPoints } = require('../services/scoring');
const { protect } = require('../middleware/auth');

const DEFAULT_SCORING = { correctOutcome: 2, oneTeamCorrect: 1, exactScoreBonus: 3, knockoutWinnerBonus: 3, extraTimeBonus: 0, penaltiesBonus: 0 };

const buildEntries = (users, matchPointsMap, tournamentPointsMap) =>
  users
    .map((member) => {
      const uid = member._id.toString();
      const matchPts = matchPointsMap[uid] || 0;
      const tournamentPts = tournamentPointsMap[uid] || 0;
      return {
        user: { _id: member._id, name: member.name, nickname: member.nickname, avatar: member.avatar, favoriteTeam: member.favoriteTeam, favoriteTeam: member.favoriteTeam },
        matchPoints: matchPts,
        tournamentPoints: tournamentPts,
        totalPoints: matchPts + tournamentPts,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

// GET /api/leaderboard/global
router.get('/global', protect, async (req, res) => {
  try {
    const users = await User.find({}, 'name nickname avatar favoriteTeam').populate('favoriteTeam', 'name shortName fifaCode badgeUrl flag');

    const matchAgg = await MatchPrediction.aggregate([
      { $match: { group: null, points: { $ne: null } } },
      { $group: { _id: '$user', matchPoints: { $sum: '$points' } } },
    ]);
    const matchPointsMap = Object.fromEntries(matchAgg.map((r) => [r._id.toString(), r.matchPoints]));

    const tournamentPredictions = await TournamentPrediction.find({ group: null }, 'user points');
    const tournamentPointsMap = Object.fromEntries(
      tournamentPredictions.map((p) => [p.user.toString(), p.points || 0])
    );

    res.json(buildEntries(users, matchPointsMap, tournamentPointsMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/leaderboard/:groupId
router.get('/:groupId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate({ path: 'members', select: 'name nickname avatar favoriteTeam', populate: { path: 'favoriteTeam', select: 'name shortName fifaCode badgeUrl flag' } })
      .populate('season', 'defaultScoringConfig');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!group.members.some((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    // Effective scoring = season defaults merged with group overrides
    const seasonCfg = group.season?.defaultScoringConfig || {};
    const groupCfg = group.scoringConfig || {};
    const effectiveCfg = { ...DEFAULT_SCORING, ...seasonCfg, ...groupCfg };
    const usingCustomScoring = Object.keys(groupCfg).length > 0;

    let matchPointsMap;

    if (!usingCustomScoring) {
      // Fast path: use pre-computed points on predictions
      const matchAgg = await MatchPrediction.aggregate([
        { $match: { group: null, user: { $in: group.members.map((m) => m._id) }, points: { $ne: null } } },
        { $group: { _id: '$user', matchPoints: { $sum: '$points' } } },
      ]);
      matchPointsMap = Object.fromEntries(matchAgg.map((r) => [r._id.toString(), r.matchPoints]));
    } else {
      // Custom scoring: recompute from raw predictions + match results
      const Match = require('../models/Match');
      const memberIds = group.members.map((m) => m._id);
      const predictions = await MatchPrediction.find({ group: null, user: { $in: memberIds } })
        .populate('match', 'homeScore awayScore winner stage status');

      matchPointsMap = {};
      for (const p of predictions) {
        if (!p.match || p.match.status !== 'finished' || p.match.homeScore == null) continue;
        const pts = calcMatchPoints(
          p.predictedHomeScore, p.predictedAwayScore,
          p.match.homeScore, p.match.awayScore,
          p.predictedWinner, p.match.winner,
          effectiveCfg
        );
        const uid = p.user.toString();
        matchPointsMap[uid] = (matchPointsMap[uid] || 0) + pts;
      }
    }

    const tournamentPredictions = await TournamentPrediction.find({
      group: null,
      user: { $in: group.members.map((m) => m._id) },
    });
    const tournamentPointsMap = Object.fromEntries(
      tournamentPredictions.map((p) => [p.user.toString(), p.points || 0])
    );

    const leaderboard = buildEntries(group.members, matchPointsMap, tournamentPointsMap);
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
