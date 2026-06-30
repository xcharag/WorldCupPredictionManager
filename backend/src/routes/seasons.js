const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Season = require('../models/Season');
const Match = require('../models/Match');
const MatchPrediction = require('../models/MatchPrediction');
const { protect } = require('../middleware/auth');
const { calcMatchPoints } = require('../services/scoring');

// ── Helpers ──────────────────────────────────────────────────────────────────

function canManageSeason(season, userId) {
  if (season.createdBy?.toString() === userId.toString()) return true;
  return false;
}

// ── Season CRUD ──────────────────────────────────────────────────────────────

// GET /api/seasons — list seasons the user can access
router.get('/', protect, async (req, res) => {
  try {
    // All official seasons + seasons for tournaments the user created
    const userTournaments = await Tournament.find({ createdBy: req.user._id }).select('_id');
    const userTournamentIds = userTournaments.map(t => t._id);

    const seasons = await Season.find({
      $or: [
        { createdBy: req.user._id },
        { tournament: { $in: userTournamentIds } },
        // Official seasons (tournament.type = 'official') — fetch via populated join
      ],
    })
      .populate('tournament', 'name icon type')
      .sort({ year: -1, createdAt: -1 });

    // Also include official tournament seasons
    const officialTournaments = await Tournament.find({ type: 'official' }).select('_id');
    const officialIds = officialTournaments.map(t => t._id.toString());
    const officialSeasons = await Season.find({ tournament: { $in: officialTournaments.map(t => t._id) } })
      .populate('tournament', 'name icon type')
      .sort({ year: -1 });

    const allSeasons = [...officialSeasons, ...seasons.filter(s => !officialIds.includes(s.tournament?._id?.toString()))];
    const seen = new Set();
    const unique = allSeasons.filter(s => {
      const id = s._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json(unique);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/seasons/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id).populate('tournament', 'name icon type createdBy');
    if (!season) return res.status(404).json({ message: 'Not found' });
    res.json(season);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/seasons — create a new season for a tournament
router.post('/', protect, async (req, res) => {
  try {
    const { tournamentId, name, year, stages, teams, defaultScoringConfig, tournamentPredictionFields } = req.body;
    if (!tournamentId || !name?.trim()) return res.status(400).json({ message: 'tournamentId and name are required' });

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.type === 'official' && !req.user.isAdmin) return res.status(403).json({ message: 'Only admins can add official seasons' });
    if (tournament.type === 'custom' && tournament.createdBy?.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

    const season = await Season.create({
      tournament: tournament._id,
      name: name.trim(),
      year: year || null,
      stages: stages || [],
      teams: teams || [],
      defaultScoringConfig: defaultScoringConfig || {},
      tournamentPredictionFields: tournamentPredictionFields || [],
      status: 'upcoming',
      apiProvider: tournament.type === 'official' ? (req.body.apiProvider || null) : null,
      apiTournamentId: tournament.type === 'official' ? (req.body.apiTournamentId || null) : null,
      createdBy: req.user._id,
    });

    res.status(201).json(season);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/seasons/:id — update season metadata + scoring config
router.patch('/:id', protect, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id).populate('tournament', 'type');
    if (!season) return res.status(404).json({ message: 'Not found' });
    if (season.tournament?.type === 'official' && !req.user.isAdmin) return res.status(403).json({ message: 'Only admins can edit official seasons' });
    if (!canManageSeason(season, req.user._id) && !req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const allowed = ['name', 'year', 'status', 'stages', 'teams', 'defaultScoringConfig', 'tournamentPredictionFields'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) season[key] = req.body[key];
    }
    await season.save();
    res.json(season);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Custom match management (custom tournaments only) ─────────────────────────

// GET /api/seasons/:id/matches — all matches for a season
router.get('/:id/matches', protect, async (req, res) => {
  try {
    const matches = await Match.find({ season: req.params.id })
      .populate('homeTeam', 'name shortName flag badgeUrl')
      .populate('awayTeam', 'name shortName flag badgeUrl')
      .sort({ matchDate: 1 });
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/seasons/:id/matches — create a match (custom season creator only)
router.post('/:id/matches', protect, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id).populate('tournament', 'type');
    if (!season) return res.status(404).json({ message: 'Season not found' });
    if (season.tournament?.type === 'official') return res.status(403).json({ message: 'Use the admin import for official seasons' });
    if (!canManageSeason(season, req.user._id)) return res.status(403).json({ message: 'Forbidden' });

    const { homeTeamName, awayTeamName, matchDate, stage, group, matchday, venue } = req.body;
    if (!homeTeamName || !awayTeamName || !matchDate || !stage) {
      return res.status(400).json({ message: 'homeTeamName, awayTeamName, matchDate, and stage are required' });
    }

    const match = await Match.create({
      season: season._id,
      homeTeamName: homeTeamName.trim(),
      awayTeamName: awayTeamName.trim(),
      matchDate: new Date(matchDate),
      stage,
      group: group || null,
      matchday: matchday || null,
      venue: venue || null,
      isManual: true,
      status: 'scheduled',
    });

    res.status(201).json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/seasons/:id/matches/:matchId — update match details or enter/update score
router.patch('/:id/matches/:matchId', protect, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id).populate('tournament', 'type');
    if (!season) return res.status(404).json({ message: 'Season not found' });
    if (season.tournament?.type === 'official') return res.status(403).json({ message: 'Forbidden for official seasons' });
    if (!canManageSeason(season, req.user._id)) return res.status(403).json({ message: 'Forbidden' });

    const match = await Match.findOne({ _id: req.params.matchId, season: season._id });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const editableFields = ['homeTeamName', 'awayTeamName', 'matchDate', 'stage', 'group', 'matchday', 'venue'];
    for (const key of editableFields) {
      if (req.body[key] !== undefined) match[key] = req.body[key];
    }

    // Score update — triggers point recalculation
    const scoringUpdate = req.body.homeScore !== undefined || req.body.awayScore !== undefined;
    if (scoringUpdate) {
      const wasFinished = match.status === 'finished';
      match.homeScore = req.body.homeScore ?? match.homeScore;
      match.awayScore = req.body.awayScore ?? match.awayScore;

      if (req.body.winner !== undefined) match.winner = req.body.winner || null;
      if (req.body.decidedBy !== undefined) match.decidedBy = req.body.decidedBy || null;
      if (req.body.extraTimeHomeScore !== undefined) match.extraTimeHomeScore = req.body.extraTimeHomeScore;
      if (req.body.extraTimeAwayScore !== undefined) match.extraTimeAwayScore = req.body.extraTimeAwayScore;
      if (req.body.penaltyHomeScore !== undefined) match.penaltyHomeScore = req.body.penaltyHomeScore;
      if (req.body.penaltyAwayScore !== undefined) match.penaltyAwayScore = req.body.penaltyAwayScore;

      if (match.homeScore != null && match.awayScore != null) {
        match.status = 'finished';
      }

      await match.save();

      // Recalculate points for all predictions of this match
      const cfg = season.defaultScoringConfig || {};
      const predictions = await MatchPrediction.find({ match: match._id });
      await Promise.all(predictions.map(p => {
        const pts = calcMatchPoints(
          p.predictedHomeScore, p.predictedAwayScore,
          match.homeScore, match.awayScore,
          p.predictedWinner, match.winner,
          cfg
        );
        return MatchPrediction.findByIdAndUpdate(p._id, { points: pts });
      }));

      return res.json(match);
    }

    await match.save();
    res.json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/seasons/:id/matches/:matchId
router.delete('/:id/matches/:matchId', protect, async (req, res) => {
  try {
    const season = await Season.findById(req.params.id).populate('tournament', 'type');
    if (!season) return res.status(404).json({ message: 'Not found' });
    if (season.tournament?.type === 'official') return res.status(403).json({ message: 'Forbidden' });
    if (!canManageSeason(season, req.user._id)) return res.status(403).json({ message: 'Forbidden' });

    const match = await Match.findOne({ _id: req.params.matchId, season: season._id });
    if (!match) return res.status(404).json({ message: 'Not found' });
    if (match.status === 'finished') return res.status(400).json({ message: 'Cannot delete a finished match' });

    await Match.deleteOne({ _id: match._id });
    await MatchPrediction.deleteMany({ match: match._id });
    res.json({ message: 'Match deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
