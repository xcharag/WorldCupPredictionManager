/**
 * Seed: importSportsDB.js
 *
 * Enriches existing MongoDB data with TheSportsDB data:
 *   1. Updates all 48 Team records with sportsdbId + badge URLs
 *   2. Downloads badge images → uploads to Minio (if configured)
 *   3. Fetches 2026 WC events (free tier: up to 15) → upserts Match records
 *
 * Run: node src/seeds/importSportsDB.js
 *
 * Requires env vars: MONGODB_URI
 * Optional:  MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET,
 *            MINIO_REGION, MINIO_PUBLIC_URL, SPORTSDB_API_KEY (default: 123)
 */

require('dotenv').config();
const https = require('https');
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Match = require('../models/Match');

// ─── Image uploader (only loaded if Minio is configured) ─────────────────────
let uploadImageFromUrl = null;
if (process.env.MINIO_ENDPOINT) {
  uploadImageFromUrl = require('../services/imageUploader').uploadImageFromUrl;
}

// ─── TheSportsDB CDN base URL ─────────────────────────────────────────────────
const BADGE_BASE = 'https://r2.thesportsdb.com/images/media/team/badge';

// ─── Full team data map: FIFA code → { id, badge } ───────────────────────────
// IDs and badge URLs sourced from TheSportsDB league page + team pages + event data
// https://www.thesportsdb.com/league/4429-fifa-world-cup
const TEAM_DATA = {
  // UEFA (16)
  GER: { id: '133907', badge: `${BADGE_BASE}/1xysi51726167152.png` },
  FRA: { id: '133913', badge: `${BADGE_BASE}/p3n0z51726166851.png` },
  ESP: { id: '133909', badge: `${BADGE_BASE}/ncgqyr1726166942.png` },
  POR: { id: '133908', badge: `${BADGE_BASE}/swqvpy1455466083.png` },
  ENG: { id: '133914', badge: `${BADGE_BASE}/vf5ttc1726166739.png` },
  NED: { id: '133905', badge: `${BADGE_BASE}/1p0hr41593787110.png` },
  BEL: { id: '134515', badge: `${BADGE_BASE}/8xlvxv1592062265.png` },
  CRO: { id: null,     badge: `${BADGE_BASE}/vvtsyu1455465317.png` },
  SUI: { id: '134506', badge: `${BADGE_BASE}/mb7yqe1717365808.png` },
  AUT: { id: '135986', badge: `${BADGE_BASE}/874p631628721400.png` },
  TUR: { id: '135985', badge: `${BADGE_BASE}/70c4oo1591982459.png` },
  SCO: { id: '136450', badge: `${BADGE_BASE}/3691i11552945146.png` },
  NOR: { id: '136516', badge: `${BADGE_BASE}/gyfn811591973155.png` },
  SWE: { id: '133916', badge: `${BADGE_BASE}/h5adzg1591981772.png` },
  CZE: { id: '133904', badge: `${BADGE_BASE}/1o0cx31654205806.png` },
  BIH: { id: '134510', badge: `${BADGE_BASE}/wtqqst1455463120.png` },

  // CONMEBOL (6)
  BRA: { id: '134496', badge: `${BADGE_BASE}/jl6dip1726167280.png` },
  ARG: { id: '134509', badge: `${BADGE_BASE}/3zplhu1726167477.png` },
  COL: { id: null,     badge: `${BADGE_BASE}/4ymyku1691180081.png` },
  URU: { id: '134504', badge: `${BADGE_BASE}/6vjbr11726167756.png` },
  ECU: { id: '134507', badge: `${BADGE_BASE}/47wv2y1591989301.png` },
  PAR: { id: '136471', badge: `${BADGE_BASE}/khgav41553419195.png` },

  // CONCACAF (6)
  USA: { id: '134514', badge: `${BADGE_BASE}/21f0oi1597948195.png` },
  MEX: { id: '134497', badge: `${BADGE_BASE}/3rmosi1748525208.png` },
  CAN: { id: '140073', badge: `${BADGE_BASE}/2t631f1595154867.png` },
  PAN: { id: '136141', badge: `${BADGE_BASE}/asp2ck1715849700.png` },
  HAI: { id: '140175', badge: `${BADGE_BASE}/gml8wx1598135302.png` },
  CUW: { id: '140271', badge: `${BADGE_BASE}/itygvb1600955363.png` },

  // CAF (10)
  MAR: { id: '136139', badge: `${BADGE_BASE}/hbmwkj1731791275.png` },
  SEN: { id: '136143', badge: `${BADGE_BASE}/wh8dya1526727459.png` },
  EGY: { id: '136138', badge: `${BADGE_BASE}/uheyzo1742102234.png` },
  GHA: { id: '134513', badge: `${BADGE_BASE}/j589xw1751526124.png` },
  CIV: { id: '134502', badge: `${BADGE_BASE}/rwxuuu1455465643.png` },
  RSA: { id: '136482', badge: `${BADGE_BASE}/xjz9j91553368824.png` },
  ALG: { id: '134516', badge: `${BADGE_BASE}/rrwpry1455460218.png` },
  TUN: { id: '136142', badge: `${BADGE_BASE}/7r89rg1526727277.png` },
  CPV: { id: '136477', badge: `${BADGE_BASE}/5jn0o71593280376.png` },
  COD: { id: '136475', badge: `${BADGE_BASE}/s85jjw1728749022.png` },

  // AFC (9)
  JPN: { id: '134503', badge: `${BADGE_BASE}/ffsyxz1591989843.png` },
  KOR: { id: '134517', badge: `${BADGE_BASE}/a8nqfs1589564916.png` },
  AUS: { id: '134500', badge: `${BADGE_BASE}/lark6k1661780848.png` },
  KSA: { id: '136137', badge: `${BADGE_BASE}/24xwpq1594125742.png` },
  IRN: { id: '134511', badge: null },  // badge URL pending confirmation
  IRQ: { id: '140148', badge: `${BADGE_BASE}/aqidfn1742100110.png` },
  UZB: { id: '140151', badge: `${BADGE_BASE}/u5bgze1597943605.png` },
  JOR: { id: '140145', badge: `${BADGE_BASE}/59fo2s1742100034.png` },
  QAT: { id: '136472', badge: `${BADGE_BASE}/rs3ir31642708685.png` },

  // OFC (1)
  NZL: { id: '137449', badge: `${BADGE_BASE}/91xpk81742982935.png` },
};

// ─── TheSportsDB team name → FIFA code (for event matching) ──────────────────
const SPORTSDB_NAME_TO_FIFA = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR',
  'Czech Republic': 'CZE', 'Canada': 'CAN', 'Bosnia-Herzegovina': 'BIH',
  'USA': 'USA', 'Paraguay': 'PAR', 'Brazil': 'BRA', 'Morocco': 'MAR',
  'Qatar': 'QAT', 'Switzerland': 'SUI', 'Haiti': 'HAI', 'Scotland': 'SCO',
  'Germany': 'GER', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Netherlands': 'NED', 'Japan': 'JPN', 'Australia': 'AUS', 'Turkey': 'TUR',
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Saudi Arabia': 'KSA', 'Uruguay': 'URU',
  'Spain': 'ESP', 'Cape Verde': 'CPV', 'Sweden': 'SWE', 'Tunisia': 'TUN',
  'France': 'FRA', 'England': 'ENG', 'Portugal': 'POR', 'Austria': 'AUT',
  'Norway': 'NOR', 'Croatia': 'CRO', 'Ghana': 'GHA', 'New Zealand': 'NZL',
  'Panama': 'PAN', 'Colombia': 'COL', 'Jordan': 'JOR', 'Senegal': 'SEN',
  'DR Congo': 'COD', 'Uzbekistan': 'UZB', 'Iran': 'IRN', 'Iraq': 'IRQ',
  'Argentina': 'ARG', 'Algeria': 'ALG',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

function apiGet(path) {
  const key = process.env.SPORTSDB_API_KEY || '123';
  const url = `https://www.thesportsdb.com/api/v1/json/${key}${path}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON from TheSportsDB: ${data.slice(0, 80)}`)); }
      });
    }).on('error', reject);
  });
}

/**
 * Determine match stage from round number and event name.
 * 2026 WC format: 48 teams, group stage (rounds 1-3), round of 32, 16, QF, SF, Final.
 */
function getStage(intRound, eventName) {
  const r = parseInt(intRound) || 1;
  if (r <= 3) return 'group_stage';
  if (r === 4) return 'round_of_32';
  if (r === 5) return 'round_of_16';
  if (r === 6) return 'quarter_final';
  if (r === 7) return 'semi_final';
  if (r === 8) {
    if ((eventName || '').toLowerCase().includes('third')) return 'third_place';
    return 'final';
  }
  return 'group_stage';
}

/**
 * Safely upload a badge to Minio, returning the public URL.
 * Falls back to the source URL on any error.
 */
async function safeUpload(sourceUrl, objectKey) {
  if (!uploadImageFromUrl || !sourceUrl) return sourceUrl;
  try {
    return await uploadImageFromUrl(sourceUrl, objectKey);
  } catch (err) {
    console.warn(`  ⚠ Minio upload failed for ${objectKey}: ${err.message} — using source URL`);
    return sourceUrl;
  }
}

// ─── Phase 1: Update teams ────────────────────────────────────────────────────

async function updateTeams() {
  console.log('\n─── Phase 1: Updating teams ──────────────────────────────────');
  const useMinio = !!uploadImageFromUrl;
  if (!useMinio) {
    console.log('ℹ  MINIO_ENDPOINT not set — badge URLs will point to TheSportsDB CDN');
  }

  let updated = 0;
  let skipped = 0;

  for (const [fifaCode, data] of Object.entries(TEAM_DATA)) {
    const team = await Team.findOne({ fifaCode });
    if (!team) {
      console.warn(`  ⚠ Team not found in DB: ${fifaCode}`);
      skipped++;
      continue;
    }

    let badgeUrl = data.badge;

    // Upload to Minio if configured
    if (badgeUrl && useMinio) {
      const ext = badgeUrl.split('.').pop() || 'png';
      badgeUrl = await safeUpload(badgeUrl, `teams/badges/${fifaCode}.${ext}`);
    }

    // Update fields
    if (data.id) team.sportsdbId = data.id;
    if (badgeUrl) team.badgeUrl = badgeUrl;

    await team.save();
    const flag = badgeUrl ? '✓' : '○';
    console.log(`  ${flag} ${fifaCode.padEnd(4)} ${team.name}`);
    updated++;
  }

  console.log(`\n  Teams updated: ${updated}, skipped: ${skipped}`);
}

// ─── Phase 2: Fetch events and upsert matches ─────────────────────────────────

async function importMatches() {
  console.log('\n─── Phase 2: Importing matches ───────────────────────────────');

  // Build sportsdbId → team lookup
  const teams = await Team.find({ sportsdbId: { $exists: true, $ne: null } }).lean();
  const byId = {};
  const byFifaCode = {};
  for (const t of teams) {
    byId[t.sportsdbId] = t._id;
    byFifaCode[t.fifaCode] = t._id;
  }

  // Fetch events — single API call (free tier: max 15 results)
  console.log('  Fetching events from TheSportsDB API (1 call)…');
  const data = await apiGet('/eventsseason.php?id=4429&s=2026');
  const events = data?.events || [];
  console.log(`  Events received: ${events.length}`);

  let upserted = 0;
  let failed = 0;

  for (const ev of events) {
    // Resolve team IDs — try by sportsdbId first, then by team name
    const homeTeamId = byId[ev.idHomeTeam]
      || byFifaCode[SPORTSDB_NAME_TO_FIFA[ev.strHomeTeam]];
    const awayTeamId = byId[ev.idAwayTeam]
      || byFifaCode[SPORTSDB_NAME_TO_FIFA[ev.strAwayTeam]];

    if (!homeTeamId || !awayTeamId) {
      console.warn(`  ⚠ Could not resolve teams for: ${ev.strHomeTeam} vs ${ev.strAwayTeam}`);
      failed++;
      continue;
    }

    // Optionally upload thumb to Minio
    let thumbUrl = ev.strThumb || null;
    if (thumbUrl && uploadImageFromUrl) {
      const ext = thumbUrl.split('.').pop() || 'jpg';
      thumbUrl = await safeUpload(thumbUrl, `matches/thumbs/${ev.idEvent}.${ext}`);
    }

    const stage = getStage(ev.intRound, ev.strEvent);

    // Try to find an existing match by the home+away team pair
    const existing = await Match.findOne({ homeTeam: homeTeamId, awayTeam: awayTeamId });

    if (existing) {
      // Only patch sportsdbId and thumbUrl — leave everything else untouched
      const patch = {};
      if (!existing.sportsdbId) patch.sportsdbId = ev.idEvent;
      if (thumbUrl && !existing.thumbUrl) patch.thumbUrl = thumbUrl;
      if (ev.intHomeScore !== null && ev.intHomeScore !== '') patch.homeScore = parseInt(ev.intHomeScore);
      if (ev.intAwayScore !== null && ev.intAwayScore !== '') patch.awayScore = parseInt(ev.intAwayScore);

      if (Object.keys(patch).length) {
        await Match.updateOne({ _id: existing._id }, { $set: patch });
        console.log(`  ✓ patched  ${ev.dateEvent} ${ev.strHomeTeam} vs ${ev.strAwayTeam}`);
      } else {
        console.log(`  – skipped  ${ev.dateEvent} ${ev.strHomeTeam} vs ${ev.strAwayTeam} (already up to date)`);
      }
    } else {
      // No existing match — insert a new one from TheSportsDB data
      await Match.create({
        sportsdbId: ev.idEvent,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        matchDate: new Date(ev.strTimestamp),
        stage,
        venue: ev.strVenue || undefined,
        homeScore: ev.intHomeScore !== null ? parseInt(ev.intHomeScore) : null,
        awayScore: ev.intAwayScore !== null ? parseInt(ev.intAwayScore) : null,
        status: ev.strStatus === 'Match Finished' ? 'finished' : 'scheduled',
        thumbUrl,
        matchNumber: parseInt(ev.intRound) || null,
      });
      console.log(`  + inserted ${ev.dateEvent} ${ev.strHomeTeam} vs ${ev.strAwayTeam} [${stage}]`);
    }

    upserted++;
  }

  console.log(`\n  Matches upserted: ${upserted}, failed: ${failed}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set');
    process.exit(1);
  }

  const dbName = resolveDbName(uri);
  await mongoose.connect(uri, { dbName });
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

  try {
    await updateTeams();
    await importMatches();
    console.log('\n✅ Import complete');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
