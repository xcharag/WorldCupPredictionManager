const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// GET /api/teams
router.get('/', async (_req, res) => {
  try {
    const teams = await Team.find({}).sort({ name: 1 });
    res.json(teams);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
