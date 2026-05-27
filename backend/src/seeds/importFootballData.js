/**
 * Seed: importFootballData.js
 *
 * Imports WC 2026 player rosters from football-data.org and links existing
 * Match documents to their football-data.org IDs (needed for live score polling).
 *
 * Run once: node src/seeds/importFootballData.js
 *
 * Requires env vars: MONGODB_URI, FOOTBALL_DATA_API_KEY
 * Optional:          MONGODB_DB (default: worldcup2026)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Team   = require('../models/Team');
const Player = require('../models/Player');
const Match  = require('../models/Match');
const { getWCTeams, getWCMatches } = require('../services/footballdata');

// ─── TLA mismatches: football-data.org TLA → our fifaCode ────────────────────
// Most 3-letter codes align 1:1; only overrides needed here.
const TLA_REMAP = {
  URY: 'URU', // Uruguay
  SAU: 'KSA', // Saudi Arabia
  DRC: 'COD', // DR Congo
  CRC: 'CRC', // Costa Rica (just in case)
  RSA: 'RSA', // South Africa — already matches
};

// ─── Position mapping: football-data.org labels → app enum ───────────────────
const POSITION_MAP = {
  Goalkeeper:           'GK',
  Defence:              'DEF',
  'Centre-Back':        'DEF',
  'Left-Back':          'DEF',
  'Right-Back':         'DEF',
  Midfield:             'MID',
  'Central Midfield':   'MID',
  'Defensive Midfield': 'MID',
  'Attacking Midfield': 'MID',
  'Left Midfield':      'MID',
  'Right Midfield':     'MID',
  'Wide Midfield':      'MID',
  Offence:              'FWD',
  'Centre-Forward':     'FWD',
  'Left Winger':        'FWD',
  'Right Winger':       'FWD',
  'Second Striker':     'FWD',
};

function normPos(apiPos) {
  return POSITION_MAP[apiPos] || 'MID'; // fall back to MID for unknown positions
}

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function importPlayers() {
  console.log('[FD Seed] Fetching WC teams + squads (1 API call)...');
  const { teams } = await getWCTeams();
  console.log(`[FD Seed] Received ${teams.length} teams from football-data.org`);

  let teamsMatched = 0;
  let teamsMissed  = 0;
  let playersUpserted = 0;

  for (const apiTeam of teams) {
    const tla      = apiTeam.tla;
    const fifaCode = TLA_REMAP[tla] || tla;

    const dbTeam = await Team.findOne({ fifaCode });
    if (!dbTeam) {
      console.warn(`  [WARN] No DB team for TLA=${tla} (tried fifaCode=${fifaCode})`);
      teamsMissed++;
      continue;
    }
    teamsMatched++;

    // Store football-data team numeric ID on our Team document
    const fdTeamId = String(apiTeam.id);
    if (dbTeam.footballDataId !== fdTeamId) {
      dbTeam.footballDataId = fdTeamId;
      await dbTeam.save();
    }

    // Upsert each squad member
    for (const p of apiTeam.squad || []) {
      const update = {
        name:           p.name,
        team:           dbTeam._id,
        position:       normPos(p.position),
        dateOfBirth:    p.dateOfBirth ? new Date(p.dateOfBirth) : undefined,
        isActive:       true,
      };
      // Remove undefined keys so we don't overwrite existing dateOfBirth with null
      Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

      await Player.findOneAndUpdate(
        { footballDataId: String(p.id) },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      playersUpserted++;
    }

    console.log(`  [OK] ${dbTeam.name} (${fifaCode}): ${(apiTeam.squad || []).length} players`);
  }

  console.log(`\n[FD Seed] Teams: matched=${teamsMatched}, missed=${teamsMissed}`);
  console.log(`[FD Seed] Players upserted: ${playersUpserted}`);
}

async function linkMatches() {
  console.log('\n[FD Seed] Fetching WC matches (1 API call)...');
  const { matches: apiMatches } = await getWCMatches();
  console.log(`[FD Seed] Received ${apiMatches.length} matches from football-data.org`);

  let linked = 0;
  let missed  = 0;

  for (const apiMatch of apiMatches) {
    const homeTla = apiMatch.homeTeam?.tla;
    const awayTla = apiMatch.awayTeam?.tla;
    if (!homeTla || !awayTla) { missed++; continue; }

    const homeFifaCode = TLA_REMAP[homeTla] || homeTla;
    const awayFifaCode = TLA_REMAP[awayTla] || awayTla;

    const [homeTeam, awayTeam] = await Promise.all([
      Team.findOne({ fifaCode: homeFifaCode }),
      Team.findOne({ fifaCode: awayFifaCode }),
    ]);
    if (!homeTeam || !awayTeam) { missed++; continue; }

    // Match the DB record by teams + date within a ±13-hour window.
    // The window is intentionally wide because football-data.org and TheSportsDB
    // sometimes store different UTC times for the same fixture (timezone discrepancies).
    // We also try both home/away orderings since the two sources sometimes swap them.
    const matchDate   = new Date(apiMatch.utcDate);
    const windowStart = new Date(matchDate.getTime() - 13 * 60 * 60 * 1000);
    const windowEnd   = new Date(matchDate.getTime() + 13 * 60 * 60 * 1000);

    const dbMatch = await Match.findOne({
      $or: [
        { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
        { homeTeam: awayTeam._id, awayTeam: homeTeam._id }, // handle swapped teams
      ],
      matchDate: { $gte: windowStart, $lte: windowEnd },
    });

    if (dbMatch) {
      dbMatch.footballDataId = String(apiMatch.id);
      await dbMatch.save();
      linked++;
    } else {
      console.warn(`  [WARN] No DB match for ${homeFifaCode} vs ${awayFifaCode} @ ${matchDate.toISOString()}`);
      missed++;
    }
  }

  console.log(`[FD Seed] Matches linked: ${linked}, missed: ${missed}`);
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('[FD Seed] MONGODB_URI is not set');
    process.exit(1);
  }
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    console.error('[FD Seed] FOOTBALL_DATA_API_KEY is not set');
    process.exit(1);
  }

  const dbName = resolveDbName(process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`[FD Seed] Connected to MongoDB (${dbName})\n`);

  await importPlayers();
  await linkMatches();

  await mongoose.disconnect();
  console.log('\n[FD Seed] Done.');
}

run().catch((err) => {
  console.error('[FD Seed] Fatal:', err.message);
  process.exit(1);
});
