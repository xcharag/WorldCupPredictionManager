const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const Match = require('../models/Match');
const Group = require('../models/Group');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');

// Helper: verify user is member of group
const assertMember = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
  if (!group.members.some((m) => m.toString() === userId.toString())) {
    throw Object.assign(new Error('Not a member of this group'), { status: 403 });
  }
  return group;
};

// POST /api/predictions/match — create or update match prediction
router.post(
  '/match',
  protect,
  [
    body('matchId').notEmpty(),
    body('predictedHomeScore').isInt({ min: 0 }),
    body('predictedAwayScore').isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { matchId, predictedHomeScore, predictedAwayScore } = req.body;

    try {
      const match = await Match.findById(matchId);
      if (!match) return res.status(404).json({ message: 'Match not found' });
      const hasStarted =
        match.status !== 'scheduled' ||
        (match.matchDate && new Date(match.matchDate).getTime() <= Date.now());
      if (hasStarted) {
        return res.status(400).json({ message: 'No podes modificar una prediccion de un partido pasado o finalizado.' });
      }

      const prediction = await MatchPrediction.findOneAndUpdate(
        { user: req.user._id, group: null, match: matchId },
        { predictedHomeScore: Number(predictedHomeScore), predictedAwayScore: Number(predictedAwayScore), points: null },
        { upsert: true, new: true, runValidators: true }
      );

      res.json(prediction);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/predictions/match/:matchId?groupId=xxx — get user's prediction for a match
router.get('/match/:matchId', protect, async (req, res) => {
  try {
    const prediction = await MatchPrediction.findOne({
      user: req.user._id,
      match: req.params.matchId,
      group: null,
    });
    res.json(prediction || null);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/predictions/mine — get current user's global match predictions
router.get('/mine', protect, async (req, res) => {
  try {
    const predictions = await MatchPrediction.find({ user: req.user._id, group: null }).populate('match');
    res.json(predictions);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/predictions/group/:groupId — get all match predictions for a group (all users + all matches)
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);
    const memberIds = group.members.map((m) => m.toString());
    const predictions = await MatchPrediction.find({ user: { $in: memberIds }, group: null })
      .populate('user', 'name nickname avatar')
      .populate('match');
    res.json(predictions);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/predictions/group/:groupId/match/:matchId — all predictions for a specific match in a group
router.get('/group/:groupId/match/:matchId', protect, async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);
    const memberIds = group.members.map((m) => m.toString());
    const predictions = await MatchPrediction.find({
      user: { $in: memberIds },
      group: null,
      match: req.params.matchId,
    }).populate('user', 'name nickname avatar');
    res.json(predictions);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/predictions/tournament — create or update tournament prediction
router.post('/tournament', protect, async (req, res) => {
  try {
    // Check if locked
    const isLocked = !!(await Settings.get('tournamentPredictionsLocked', false)) || !!(await Match.exists({ status: 'finished' }));
    if (isLocked) {
      return res.status(400).json({ message: 'Tournament predictions are locked' });
    }

    // Convert empty strings to null — avoids ObjectId cast errors for unpopulated fields
    const toId = (v) => (v && typeof v === 'string' && v.trim() !== '') ? v : null;
    const update = {
      champion:        toId(req.body.champion),
      runnerUp:        toId(req.body.runnerUp),
      topScorer:       toId(req.body.topScorer),
      topAssister:     toId(req.body.topAssister),
      mostYellowCards: toId(req.body.mostYellowCards),
      mostRedCards:    toId(req.body.mostRedCards),
      points: null, // reset so scoring gets recalculated after the tournament
    };

    const prediction = await TournamentPrediction.findOneAndUpdate(
      { user: req.user._id, group: null },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(prediction);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/predictions/tournament/:groupId — get user's tournament prediction
router.get('/tournament/:groupId', protect, async (req, res) => {
  try {
    const prediction = await TournamentPrediction.findOne({
      user: req.user._id,
      group: null,
    })
      .populate('champion', 'name shortName flag')
      .populate('runnerUp', 'name shortName flag')
      .populate('topScorer', 'name team')
      .populate('topAssister', 'name team')
      .populate('mostYellowCards', 'name team')
      .populate('mostRedCards', 'name team');

    const isLocked = !!(await Settings.get('tournamentPredictionsLocked', false)) || !!(await Match.exists({ status: 'finished' }));
    res.json({ prediction: prediction || null, isLocked });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/predictions/tournament — get user's global tournament prediction
router.get('/tournament', protect, async (req, res) => {
  try {
    const prediction = await TournamentPrediction.findOne({ user: req.user._id, group: null })
      .populate('champion', 'name shortName flag')
      .populate('runnerUp', 'name shortName flag')
      .populate('topScorer', 'name team')
      .populate('topAssister', 'name team')
      .populate('mostYellowCards', 'name team')
      .populate('mostRedCards', 'name team');

    const isLocked = !!(await Settings.get('tournamentPredictionsLocked', false)) || !!(await Match.exists({ status: 'finished' }));
    const firstMatch = await Match.findOne().sort({ matchDate: 1 }).select('matchDate');
    res.json({ prediction: prediction || null, isLocked, lockAt: firstMatch?.matchDate || null });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
