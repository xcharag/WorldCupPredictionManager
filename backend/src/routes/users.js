const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MatchPrediction = require('../models/MatchPrediction');
const TournamentPrediction = require('../models/TournamentPrediction');
const { protect } = require('../middleware/auth');

// GET /api/users/:userId  — public profile + finished-match predictions
router.get('/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name nickname avatar favoriteTeam')
      .populate('favoriteTeam', 'name shortName fifaCode badgeUrl flag');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only expose predictions for finished matches
    const predictions = await MatchPrediction.find({ user: user._id, group: null })
      .populate({
        path: 'match',
        match: { status: 'finished' },
        select: 'matchDate stage homeScore awayScore homeTeam awayTeam status',
        populate: [
          { path: 'homeTeam', select: 'name shortName flag badgeUrl' },
          { path: 'awayTeam', select: 'name shortName flag badgeUrl' },
        ],
      })
      .sort({ createdAt: -1 });

    // Filter out predictions whose match didn't satisfy the populate match condition
    const finishedPredictions = predictions.filter((p) => p.match !== null);

    const tournamentPrediction = await TournamentPrediction.findOne({ user: user._id, group: null })
      .populate('champion', 'name shortName flag')
      .populate('runnerUp', 'name shortName flag')
      .populate({ path: 'topScorer', select: 'name team', populate: { path: 'team', select: 'name shortName flag' } })
      .populate({ path: 'topAssister', select: 'name team', populate: { path: 'team', select: 'name shortName flag' } })
      .populate({ path: 'mostYellowCards', select: 'name team', populate: { path: 'team', select: 'name shortName flag' } })
      .populate({ path: 'mostRedCards', select: 'name team', populate: { path: 'team', select: 'name shortName flag' } });

    res.json({ user, predictions: finishedPredictions, tournamentPrediction: tournamentPrediction || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
