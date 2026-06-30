const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Season = require('../models/Season');
const { protect } = require('../middleware/auth');

// GET /api/tournaments — list all official tournaments + user's own custom ones
router.get('/', protect, async (req, res) => {
  try {
    const tournaments = await Tournament.find({
      $or: [{ type: 'official' }, { createdBy: req.user._id }],
    }).sort({ type: -1, createdAt: 1 }); // official first

    // Attach season count to each
    const ids = tournaments.map(t => t._id);
    const seasonCounts = await Season.aggregate([
      { $match: { tournament: { $in: ids } } },
      { $group: { _id: '$tournament', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(seasonCounts.map(s => [s._id.toString(), s.count]));

    res.json(tournaments.map(t => ({ ...t.toObject(), seasonCount: countMap[t._id.toString()] || 0 })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tournaments/:id — tournament + its seasons
router.get('/:id', protect, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Not found' });

    const canView = tournament.type === 'official' || tournament.createdBy?.toString() === req.user._id.toString();
    if (!canView) return res.status(403).json({ message: 'Forbidden' });

    const seasons = await Season.find({ tournament: tournament._id })
      .select('name year status apiProvider teams stages defaultScoringConfig tournamentPredictionFields')
      .sort({ year: -1 });

    res.json({ tournament, seasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tournaments — create a custom tournament (any user)
router.post('/', protect, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
    const tournament = await Tournament.create({
      name: name.trim(),
      slug,
      icon: icon || '🏆',
      type: 'custom',
      isPublic: false,
      createdBy: req.user._id,
    });

    res.status(201).json(tournament);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/tournaments/:id — update name/icon (creator only)
router.patch('/:id', protect, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Not found' });
    if (tournament.type === 'official') return res.status(403).json({ message: 'Cannot edit official tournaments' });
    if (tournament.createdBy?.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

    const { name, icon } = req.body;
    if (name) tournament.name = name.trim();
    if (icon) tournament.icon = icon;
    await tournament.save();
    res.json(tournament);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
