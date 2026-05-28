const express = require('express');
const router = express.Router();
const Changelog = require('../models/Changelog');

// GET /api/changelog — public, newest first
router.get('/', async (_req, res) => {
  try {
    const entries = await Changelog.find().sort({ date: -1 }).lean();
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
