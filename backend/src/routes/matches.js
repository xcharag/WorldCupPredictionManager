const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');

// GET /api/matches — list matches (public)
router.get('/', async (req, res) => {
  try {
    const { stage, group, status, matchday } = req.query;
    const filter = {};
    if (stage) filter.stage = stage;
    if (group) filter.group = group.toUpperCase();
    if (status) filter.status = status;
    if (matchday) filter.matchday = Number(matchday);

    const matches = await Match.find(filter)
      .populate('homeTeam', 'name shortName flag badgeUrl')
      .populate('awayTeam', 'name shortName flag badgeUrl')
      .sort({ matchDate: 1 });

    res.json(matches);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/matches/:id
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('homeTeam', 'name shortName flag badgeUrl')
      .populate('awayTeam', 'name shortName flag badgeUrl');
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
