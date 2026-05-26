const express = require('express');
const router = express.Router();
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Group = require('../models/Group');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const buildEntries = (users, matchPointsMap, tournamentPointsMap) =>
  users
    .map((member) => {
      const uid = member._id.toString();
      const matchPts = matchPointsMap[uid] || 0;
      const tournamentPts = tournamentPointsMap[uid] || 0;
      return {
        user: { _id: member._id, name: member.name, nickname: member.nickname, avatar: member.avatar },
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
    const users = await User.find({}, 'name nickname avatar');

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
    const group = await Group.findById(req.params.groupId).populate('members', 'name nickname avatar');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!group.members.some((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    // Aggregate match points per user in this group
    const matchAgg = await MatchPrediction.aggregate([
      { $match: { group: null, user: { $in: group.members.map((m) => m._id) }, points: { $ne: null } } },
      { $group: { _id: '$user', matchPoints: { $sum: '$points' } } },
    ]);
    const matchPointsMap = Object.fromEntries(matchAgg.map((r) => [r._id.toString(), r.matchPoints]));

    // Get tournament points per user
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
