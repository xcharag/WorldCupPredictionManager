const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { calculateMatchPredictions, calculateTournamentPredictions } = require('../services/scoring');

router.use(protect, requireAdmin);

// ─── FILE UPLOAD (CSV) ────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else { quoted = !quoted; }
    } else if (ch === ',' && !quoted) {
      out.push(cur); cur = '';
    } else { cur += ch; }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsvRows(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
}

function parseDateTimeFlexible(dateText, timeText) {
  const d = String(dateText || '').trim();
  const t = String(timeText || '').trim();
  const dateMatch = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const timeMatch = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

// POST /api/admin/matches/bulk-csv — receive CSV file, parse + import server-side
router.post('/matches/bulk-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const rows = parseCsvRows(req.file.buffer.toString('utf8'));
    if (!rows.length) return res.status(400).json({ message: 'Archivo CSV vacio o invalido' });

    const validStages = new Set(['group_stage', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']);
    const validStatuses = new Set(['scheduled', 'in_progress', 'finished']);
    const teamMap = new Map((await Team.find({}, 'fifaCode')).map((t) => [String(t.fifaCode || '').toUpperCase(), t._id]));

    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const homeFifaCode = String(row.homeFifaCode || '').trim().toUpperCase();
      const awayFifaCode = String(row.awayFifaCode || '').trim().toUpperCase();
      const stage = String(row.stage || '').trim();
      const group = String(row.group || '').trim().toUpperCase();
      const venue = String(row.venue || '').trim();
      const status = String(row.status || 'scheduled').trim();
      const homeScoreRaw = row.homeScore;
      const awayScoreRaw = row.awayScore;
      const matchNumberRaw = row.matchNumber;

      if (!homeFifaCode || !awayFifaCode || !stage) { errors.push({ row: i + 1, message: 'Missing homeFifaCode, awayFifaCode or stage' }); skipped++; continue; }
      if (!validStages.has(stage)) { errors.push({ row: i + 1, message: 'Invalid stage' }); skipped++; continue; }
      if (!validStatuses.has(status)) { errors.push({ row: i + 1, message: 'Invalid status' }); skipped++; continue; }

      const homeTeam = teamMap.get(homeFifaCode);
      const awayTeam = teamMap.get(awayFifaCode);
      if (!homeTeam || !awayTeam) { errors.push({ row: i + 1, message: `Team not found: ${homeFifaCode} vs ${awayFifaCode}` }); skipped++; continue; }
      if (homeTeam.toString() === awayTeam.toString()) { errors.push({ row: i + 1, message: 'Same team on both sides' }); skipped++; continue; }

      let matchDate = null;
      const dateRaw = String(row.date || '').trim();
      const timeRaw = String(row.time || '').trim();
      if (dateRaw || timeRaw) {
        matchDate = parseDateTimeFlexible(dateRaw, timeRaw);
        if (!matchDate) { errors.push({ row: i + 1, message: 'Invalid date/time (use d/M/yyyy and H:mm)' }); skipped++; continue; }
      } else if (row.matchDate) {
        const p = new Date(row.matchDate);
        if (!Number.isNaN(p.getTime())) matchDate = p;
      }
      if (!matchDate) { errors.push({ row: i + 1, message: 'Missing date/time' }); skipped++; continue; }

      const hasHS = homeScoreRaw !== undefined && homeScoreRaw !== null && String(homeScoreRaw).trim() !== '';
      const hasAS = awayScoreRaw !== undefined && awayScoreRaw !== null && String(awayScoreRaw).trim() !== '';
      const homeScore = hasHS ? Number(homeScoreRaw) : null;
      const awayScore = hasAS ? Number(awayScoreRaw) : null;
      if ((hasHS && Number.isNaN(homeScore)) || (hasAS && Number.isNaN(awayScore))) { errors.push({ row: i + 1, message: 'Invalid score' }); skipped++; continue; }
      if (status === 'finished' && (!hasHS || !hasAS)) { errors.push({ row: i + 1, message: 'Finished match needs scores' }); skipped++; continue; }

      const matchNumber = matchNumberRaw !== undefined && String(matchNumberRaw).trim() !== '' ? Number(matchNumberRaw) : undefined;
      if (matchNumber !== undefined && Number.isNaN(matchNumber)) { errors.push({ row: i + 1, message: 'Invalid matchNumber' }); skipped++; continue; }

      const query = matchNumber !== undefined ? { matchNumber } : { homeTeam, awayTeam, matchDate };
      const existing = await Match.findOne(query);
      if (existing) {
        existing.homeTeam = homeTeam; existing.awayTeam = awayTeam; existing.matchDate = matchDate;
        existing.stage = stage; existing.group = group || undefined; existing.venue = venue || undefined;
        existing.status = status; existing.homeScore = hasHS ? homeScore : null; existing.awayScore = hasAS ? awayScore : null;
        if (matchNumber !== undefined) existing.matchNumber = matchNumber;
        await existing.save(); updated++;
      } else {
        await Match.create({ matchNumber, homeTeam, awayTeam, matchDate, stage, group: group || undefined, venue: venue || undefined, status, homeScore: hasHS ? homeScore : null, awayScore: hasAS ? awayScore : null });
        created++;
      }
    }
    res.json({ total: rows.length, created, updated, skipped, errors });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/admin/players/bulk-csv — receive CSV file, parse + import server-side
router.post('/players/bulk-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const lines = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return res.status(400).json({ message: 'Archivo CSV vacio o invalido' });

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (name) => headers.indexOf(name);
    const iName = idx('name'), iTeam = idx('teamshortname'), iPos = idx('position'), iNum = idx('number');
    if (iName < 0 || iTeam < 0 || iPos < 0) return res.status(400).json({ message: 'CSV invalido: faltan columnas name, teamShortName o position' });

    const rows = lines.slice(1)
      .map((line) => { const c = parseCsvLine(line); return { name: c[iName] || '', teamShortName: c[iTeam] || '', position: c[iPos] || '', number: c[iNum] || '' }; })
      .filter((r) => r.name || r.teamShortName || r.position);
    if (!rows.length) return res.status(400).json({ message: 'No se encontraron filas de datos' });

    const teamMap = new Map((await Team.find({}, 'shortName')).map((t) => [String(t.shortName || '').toUpperCase(), t._id]));
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const { name, teamShortName, position, number: numText } = rows[i];
      const pos = position.trim().toUpperCase();
      const teamId = teamMap.get(teamShortName.trim().toUpperCase());
      const number = numText !== '' ? Number(numText) : undefined;
      if (!name || !teamShortName || !pos) { errors.push({ row: i + 1, message: 'Missing fields' }); skipped++; continue; }
      if (!['GK', 'DEF', 'MID', 'FWD'].includes(pos)) { errors.push({ row: i + 1, message: 'Invalid position' }); skipped++; continue; }
      if (!teamId) { errors.push({ row: i + 1, message: `Team not found: ${teamShortName}` }); skipped++; continue; }
      if (number !== undefined && Number.isNaN(number)) { errors.push({ row: i + 1, message: 'Invalid number' }); skipped++; continue; }
      const existing = await Player.findOne({ name, team: teamId });
      if (existing) { existing.position = pos; existing.number = Number.isNaN(number) ? undefined : number; await existing.save(); updated++; }
      else { await Player.create({ name, team: teamId, position: pos, number: Number.isNaN(number) ? undefined : number }); created++; }
    }
    res.json({ total: rows.length, created, updated, skipped, errors });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ─── TEAMS ───────────────────────────────────────────────
router.get('/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.json(teams);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/teams', [body('name').notEmpty(), body('shortName').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const team = await Team.create(req.body);
    res.status(201).json(team);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/teams/:id', async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/teams/:id', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/teams/export-csv — downloadable teams list with fifaCode
router.get('/teams/export-csv', async (_req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    const rows = ['fifaCode,shortName,name,flag,confederation'];
    teams.forEach((t) => {
      rows.push([
        t.fifaCode || '',
        t.shortName || '',
        `"${String(t.name || '').replace(/"/g, '""')}"`,
        t.flag || '',
        t.confederation || '',
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="equipos_fifa_codes.csv"');
    res.status(200).send(rows.join('\n'));
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PLAYERS ─────────────────────────────────────────────
router.get('/players', async (req, res) => {
  try {
    const filter = {};
    if (req.query.team) filter.team = req.query.team;
    const players = await Player.find(filter).populate('team', 'name shortName flag').sort({ name: 1 });
    res.json(players);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/players', [body('name').notEmpty(), body('team').notEmpty(), body('position').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const player = await Player.create(req.body);
    await player.populate('team', 'name shortName flag');
    res.status(201).json(player);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/players/:id', async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('team', 'name shortName flag');
    if (!player) return res.status(404).json({ message: 'Player not found' });
    res.json(player);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/players/:id', async (req, res) => {
  try {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: 'Player deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/players/template-csv — downloadable template for bulk upload
router.get('/players/template-csv', async (_req, res) => {
  const csv = [
    'name,teamShortName,position,number',
    'Lionel Messi,ARG,FWD,10',
    'Alisson Becker,BRA,GK,1',
    'Pedri,ESP,MID,8',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_jugadores.csv"');
  res.status(200).send(csv);
});

// POST /api/admin/players/bulk — import many players
router.post('/players/bulk', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.players) ? req.body.players : [];
    const overwrite = req.body.overwrite === true;
    if (!rows.length) return res.status(400).json({ message: 'players array is required' });

    const teamMap = new Map((await Team.find({}, 'shortName')).map((t) => [t.shortName?.toUpperCase(), t._id]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const name = String(row.name || '').trim();
      const teamShortName = String(row.teamShortName || '').trim().toUpperCase();
      const position = String(row.position || '').trim().toUpperCase();
      const number = row.number !== undefined && row.number !== null && String(row.number).trim() !== ''
        ? Number(row.number)
        : undefined;

      if (!name || !teamShortName || !position) {
        errors.push({ row: i + 1, message: 'Missing name, teamShortName or position' });
        skipped++;
        continue;
      }

      if (!['GK', 'DEF', 'MID', 'FWD'].includes(position)) {
        errors.push({ row: i + 1, message: 'Invalid position (use GK, DEF, MID, FWD)' });
        skipped++;
        continue;
      }

      const teamId = teamMap.get(teamShortName);
      if (!teamId) {
        errors.push({ row: i + 1, message: `Team not found for shortName ${teamShortName}` });
        skipped++;
        continue;
      }

      const existing = await Player.findOne({ name, team: teamId });
      if (existing) {
        if (!overwrite) {
          skipped++;
          continue;
        }
        existing.position = position;
        existing.number = Number.isNaN(number) ? undefined : number;
        await existing.save();
        updated++;
        continue;
      }

      await Player.create({
        name,
        team: teamId,
        position,
        number: Number.isNaN(number) ? undefined : number,
      });
      created++;
    }

    res.json({
      message: 'Bulk import processed',
      created,
      updated,
      skipped,
      errors,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── MATCHES ─────────────────────────────────────────────
router.get('/matches', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('homeTeam', 'name shortName flag')
      .populate('awayTeam', 'name shortName flag')
      .sort({ matchDate: 1 });
    res.json(matches);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/matches', [body('matchDate').notEmpty(), body('stage').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const match = await Match.create(req.body);
    await match.populate('homeTeam awayTeam', 'name shortName flag');
    res.status(201).json(match);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/matches/:id', async (req, res) => {
  try {
    const update = { ...req.body };
    // Convert empty strings to null so Mongoose doesn't try to cast '' → ObjectId
    if (update.homeTeam === '') update.homeTeam = null;
    if (update.awayTeam === '') update.awayTeam = null;
    const match = await Match.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('homeTeam awayTeam', 'name shortName flag');
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (err) {
    console.error('[Admin] Match update error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.delete('/matches/:id', async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// GET /api/admin/matches/template-csv — downloadable template for bulk upload
router.get('/matches/template-csv', async (_req, res) => {
  const csv = [
    'matchNumber,homeFifaCode,awayFifaCode,date,time,stage,group,venue,status,homeScore,awayScore',
    '1,ARG,BRA,11-06-2026,18:00,group_stage,A,Estadio Azteca,scheduled,,',
    '2,ESP,FRA,11-06-2026,21:00,group_stage,B,SoFi Stadium,scheduled,,',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_partidos.csv"');
  res.status(200).send(csv);
});

// POST /api/admin/matches/bulk — import many matches from parsed rows
router.post('/matches/bulk', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.matches) ? req.body.matches : [];
    const overwrite = req.body.overwrite === true;
    if (!rows.length) return res.status(400).json({ message: 'matches array is required' });

    const validStages = new Set(['group_stage', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']);
    const validStatuses = new Set(['scheduled', 'in_progress', 'finished']);
    const teamMap = new Map((await Team.find({}, 'fifaCode')).map((t) => [String(t.fifaCode || '').toUpperCase(), t._id]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const parseDateTime = (dateText, timeText) => {
      const d = String(dateText || '').trim();
      const t = String(timeText || '').trim();
      const dateMatch = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      const timeMatch = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!dateMatch || !timeMatch) return null;

      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const year = Number(dateMatch[3]);
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);

      if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
        return null;
      }

      const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
      ) {
        return null;
      }

      return parsed;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const matchNumberRaw = row.matchNumber;
      const homeFifaCode = String(row.homeFifaCode || '').trim().toUpperCase();
      const awayFifaCode = String(row.awayFifaCode || '').trim().toUpperCase();
      const dateRaw = String(row.date || '').trim();
      const timeRaw = String(row.time || '').trim();
      const matchDateRaw = String(row.matchDate || '').trim();
      const stage = String(row.stage || '').trim();
      const group = String(row.group || '').trim().toUpperCase();
      const venue = String(row.venue || '').trim();
      const status = String(row.status || 'scheduled').trim();
      const homeScoreRaw = row.homeScore;
      const awayScoreRaw = row.awayScore;

      if (!homeFifaCode || !awayFifaCode || !stage) {
        errors.push({ row: i + 1, message: 'Missing homeFifaCode, awayFifaCode or stage' });
        skipped++;
        continue;
      }

      if (!validStages.has(stage)) {
        errors.push({ row: i + 1, message: 'Invalid stage value' });
        skipped++;
        continue;
      }

      if (!validStatuses.has(status)) {
        errors.push({ row: i + 1, message: 'Invalid status value' });
        skipped++;
        continue;
      }

      const homeTeam = teamMap.get(homeFifaCode);
      const awayTeam = teamMap.get(awayFifaCode);
      if (!homeTeam || !awayTeam) {
        errors.push({ row: i + 1, message: `Team not found by fifaCode (${homeFifaCode} vs ${awayFifaCode})` });
        skipped++;
        continue;
      }

      if (homeTeam.toString() === awayTeam.toString()) {
        errors.push({ row: i + 1, message: 'Home and away teams cannot be the same' });
        skipped++;
        continue;
      }

      let matchDate = null;
      if (dateRaw || timeRaw) {
        matchDate = parseDateTime(dateRaw, timeRaw);
        if (!matchDate) {
          errors.push({ row: i + 1, message: 'Invalid date/time format (use dd-MM-yyyy and HH:mm)' });
          skipped++;
          continue;
        }
      } else if (matchDateRaw) {
        // Backward compatibility with old template using matchDate
        const parsed = new Date(matchDateRaw);
        if (!Number.isNaN(parsed.getTime())) {
          matchDate = parsed;
        }
      }

      if (!matchDate) {
        errors.push({ row: i + 1, message: 'Missing date/time columns (date dd-MM-yyyy, time HH:mm)' });
        skipped++;
        continue;
      }

      const hasHomeScore = homeScoreRaw !== undefined && homeScoreRaw !== null && String(homeScoreRaw).trim() !== '';
      const hasAwayScore = awayScoreRaw !== undefined && awayScoreRaw !== null && String(awayScoreRaw).trim() !== '';
      const homeScore = hasHomeScore ? Number(homeScoreRaw) : null;
      const awayScore = hasAwayScore ? Number(awayScoreRaw) : null;

      if ((hasHomeScore && Number.isNaN(homeScore)) || (hasAwayScore && Number.isNaN(awayScore))) {
        errors.push({ row: i + 1, message: 'Invalid score value' });
        skipped++;
        continue;
      }

      if (status === 'finished' && (!hasHomeScore || !hasAwayScore)) {
        errors.push({ row: i + 1, message: 'Finished matches require homeScore and awayScore' });
        skipped++;
        continue;
      }

      const matchNumber = matchNumberRaw !== undefined && matchNumberRaw !== null && String(matchNumberRaw).trim() !== ''
        ? Number(matchNumberRaw)
        : undefined;

      if (matchNumber !== undefined && Number.isNaN(matchNumber)) {
        errors.push({ row: i + 1, message: 'Invalid matchNumber value' });
        skipped++;
        continue;
      }

      const query = matchNumber !== undefined
        ? { matchNumber }
        : { homeTeam, awayTeam, matchDate };

      const existing = await Match.findOne(query);
      if (existing) {
        if (!overwrite) {
          skipped++;
          continue;
        }

        existing.homeTeam = homeTeam;
        existing.awayTeam = awayTeam;
        existing.matchDate = matchDate;
        existing.stage = stage;
        existing.group = group || undefined;
        existing.venue = venue || undefined;
        existing.status = status;
        existing.homeScore = hasHomeScore ? homeScore : null;
        existing.awayScore = hasAwayScore ? awayScore : null;
        if (matchNumber !== undefined) existing.matchNumber = matchNumber;
        await existing.save();
        updated++;
        continue;
      }

      await Match.create({
        matchNumber,
        homeTeam,
        awayTeam,
        matchDate,
        stage,
        group: group || undefined,
        venue: venue || undefined,
        status,
        homeScore: hasHomeScore ? homeScore : null,
        awayScore: hasAwayScore ? awayScore : null,
      });
      created++;
    }

    res.json({ message: 'Bulk import processed', created, updated, skipped, errors });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/matches/:id/result — set match result
router.put('/matches/:id/result', async (req, res) => {
  try {
    const { homeScore, awayScore, status } = req.body;
    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ message: 'homeScore and awayScore required' });
    }

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore: Number(homeScore), awayScore: Number(awayScore), status: status || 'finished' },
      { new: true }
    ).populate('homeTeam awayTeam', 'name shortName flag');

    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Auto-calculate points if finished
    if (match.status === 'finished') {
      try {
        await calculateMatchPredictions(match._id);
      } catch (e) {
        console.warn('Scoring calculation warning:', e.message);
      }
    }

    res.json(match);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// ─── SCORING ─────────────────────────────────────────────
// POST /api/admin/scoring/recalculate-match
router.post('/scoring/recalculate-match', async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return res.status(400).json({ message: 'matchId required' });
    const count = await calculateMatchPredictions(matchId);
    res.json({ message: `Recalculated ${count} predictions` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/admin/scoring/recalculate-tournament
router.post('/scoring/recalculate-tournament', async (req, res) => {
  try {
    const count = await calculateTournamentPredictions();
    res.json({ message: `Recalculated ${count} tournament predictions` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── SETTINGS ────────────────────────────────────────────
// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const locked = await Settings.get('tournamentPredictionsLocked', false);
    const results = await Settings.get('tournamentResults', null);
    res.json({ tournamentPredictionsLocked: locked, tournamentResults: results });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// POST /api/admin/settings/lock-tournament
router.post('/settings/lock-tournament', async (req, res) => {
  try {
    const { locked } = req.body;
    await Settings.set('tournamentPredictionsLocked', locked !== false);
    res.json({ message: `Tournament predictions ${locked !== false ? 'locked' : 'unlocked'}` });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// PUT /api/admin/tournament-results — set final tournament stats
router.put('/tournament-results', async (req, res) => {
  try {
    const { champion, runnerUp, topScorer, topAssister, mostYellowCards, mostRedCards } = req.body;
    const results = { champion, runnerUp, topScorer, topAssister, mostYellowCards, mostRedCards };
    await Settings.set('tournamentResults', results);
    res.json({ message: 'Tournament results saved', results });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
