/**
 * Seed: importFootballDataKnockout.js
 *
 * Creates Match documents for WC 2026 knockout-stage fixtures (Round of 32,
 * Round of 16, Quarter-Finals, Semi-Finals, Third-Place Play-off, Final)
 * imported from football-data.org.
 *
 * - If a team is already known (non-null TLA in the API), it is linked.
 * - If a team is TBD (null TLA), the homeTeam/awayTeam field is left unset.
 * - Matches already linked (footballDataId exists in DB) are skipped.
 *
 * Run: node src/seeds/importFootballDataKnockout.js
 *
 * Requires env vars: MONGODB_URI, FOOTBALL_DATA_API_KEY
 * Optional:          MONGODB_DB (default: worldcup2026)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Team  = require('../models/Team');
const { getWCMatches } = require('../services/footballdata');

// ─── Stage mapping: football-data.org → app enum ─────────────────────────────
const STAGE_MAP = {
  GROUP_STAGE:    'group_stage',
  LAST_32:        'round_of_32',
  LAST_16:        'round_of_16',
  QUARTER_FINALS: 'quarter_final',
  SEMI_FINALS:    'semi_final',
  THIRD_PLACE:    'third_place',
  FINAL:          'final',
};

// TLA mismatches (same as in importFootballData.js)
const TLA_REMAP = { URY: 'URU', SAU: 'KSA', DRC: 'COD' };

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function resolveTeam(apiTeamObj) {
  if (!apiTeamObj?.tla) return null;
  const fifaCode = TLA_REMAP[apiTeamObj.tla] || apiTeamObj.tla;
  const team = await Team.findOne({ fifaCode }).select('_id');
  return team?._id || null;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('[KO Seed] MONGODB_URI is not set');
    process.exit(1);
  }
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    console.error('[KO Seed] FOOTBALL_DATA_API_KEY is not set');
    process.exit(1);
  }

  const dbName = resolveDbName(process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`[KO Seed] Connected to MongoDB (${dbName})\n`);

  console.log('[KO Seed] Fetching WC matches (1 API call)...');
  const { matches: apiMatches } = await getWCMatches();

  const knockoutMatches = apiMatches.filter((m) => m.stage !== 'GROUP_STAGE');
  console.log(`[KO Seed] ${knockoutMatches.length} knockout matches found in API`);

  const stageCounts = {};
  let created = 0;
  let skipped = 0;

  for (const apiMatch of knockoutMatches) {
    const stage = STAGE_MAP[apiMatch.stage];
    if (!stage) {
      console.warn(`[KO Seed] Unknown stage "${apiMatch.stage}" — skipping`);
      skipped++;
      continue;
    }

    // Skip if already linked to this football-data match ID
    const exists = await Match.exists({ footballDataId: String(apiMatch.id) });
    if (exists) {
      skipped++;
      continue;
    }

    // Try to resolve teams (they'll be null/TBD for most knockout fixtures pre-tournament)
    const homeTeamId = await resolveTeam(apiMatch.homeTeam);
    const awayTeamId = await resolveTeam(apiMatch.awayTeam);

    const matchData = {
      footballDataId: String(apiMatch.id),
      matchDate:      new Date(apiMatch.utcDate),
      stage,
      status:         'scheduled',
      venue:          apiMatch.venue || null,
    };
    if (homeTeamId) matchData.homeTeam = homeTeamId;
    if (awayTeamId) matchData.awayTeam = awayTeamId;

    await Match.create(matchData);
    created++;
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  console.log(`\n[KO Seed] Created: ${created}, Skipped (already exists): ${skipped}`);
  if (Object.keys(stageCounts).length) {
    console.log('[KO Seed] Breakdown:');
    for (const [stage, count] of Object.entries(stageCounts)) {
      console.log(`  ${stage}: ${count} matches`);
    }
  }

  await mongoose.disconnect();
  console.log('\n[KO Seed] Done.');
}

run().catch((err) => {
  console.error('[KO Seed] Fatal:', err.message);
  process.exit(1);
});
