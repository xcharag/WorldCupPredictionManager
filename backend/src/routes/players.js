const express = require('express');
const router = express.Router();
const Player = require('../models/Player');

// GET /api/players?team=xxx
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.team) filter.team = req.query.team;
    if (req.query.position) filter.position = req.query.position;
    const players = await Player.find(filter).populate('team', 'name shortName flag').sort({ name: 1 });
    res.json(players);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('team', 'name shortName flag');
    if (!player) return res.status(404).json({ message: 'Player not found' });
    res.json(player);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
