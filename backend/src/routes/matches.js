const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Settings = require('../models/Settings');
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

// GET /api/matches/standings — serves cached standings synced hourly by the cron job.
// Falls back to a DB calculation if the cache hasn't been populated yet (e.g. first boot).
router.get('/standings', protect, async (req, res) => {
  try {
    const cached = await Settings.get('wcStandings', null);
    if (cached?.standings) {
      return res.json({ standings: cached.standings, updatedAt: cached.updatedAt, source: 'cache' });
    }

    // Fallback: calculate from DB match results (no API call)
    const matches = await Match.find({ stage: 'group_stage' })
      .populate('homeTeam', 'name shortName flag fifaCode badgeUrl')
      .populate('awayTeam', 'name shortName flag fifaCode badgeUrl')
      .lean();

    const groupTables = {};
    for (const m of matches) {
      const g = m.group;
      if (!g) continue;
      if (!groupTables[g]) groupTables[g] = {};
      for (const team of [m.homeTeam, m.awayTeam]) {
        if (!team) continue;
        const id = String(team._id);
        if (!groupTables[g][id]) {
          groupTables[g][id] = { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
        }
      }
      if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) continue;
      const homeId = String(m.homeTeam._id);
      const awayId = String(m.awayTeam._id);
      const home = groupTables[g][homeId];
      const away = groupTables[g][awayId];
      home.played++; home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
      away.played++; away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;
      if (m.homeScore > m.awayScore)      { home.won++; home.points += 3; away.lost++; }
      else if (m.homeScore === m.awayScore){ home.drawn++; home.points++; away.drawn++; away.points++; }
      else                                { away.won++; away.points += 3; home.lost++; }
      home.goalDiff = home.goalsFor - home.goalsAgainst;
      away.goalDiff = away.goalsFor - away.goalsAgainst;
    }

    const standings = {};
    for (const [g, teams] of Object.entries(groupTables).sort()) {
      standings[g] = Object.values(teams).sort((a, b) =>
        b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor
      );
    }
    res.json({ standings, updatedAt: null, source: 'db' });
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
