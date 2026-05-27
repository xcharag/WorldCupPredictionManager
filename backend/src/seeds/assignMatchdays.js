/**
 * Seed: assignMatchdays.js
 *
 * Assigns `matchday` (1, 2 or 3) to every group-stage Match.
 *
 * Logic: within each group (A–L), matches are sorted by date.
 * A 4-team round-robin produces 6 matches → 3 matchdays × 2 matches each:
 *   Position 1–2 (earliest dates) → matchday 1
 *   Position 3–4                  → matchday 2
 *   Position 5–6 (latest dates)   → matchday 3
 *
 * Run: node src/seeds/assignMatchdays.js
 * Requires env vars: MONGODB_URI
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function run() {
  const dbName = resolveDbName(MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { dbName });
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

  // Fetch all group stage matches
  const groupMatches = await Match.find({ stage: 'group_stage' }).sort({ group: 1, matchDate: 1 });
  console.log(`Found ${groupMatches.length} group stage matches`);

  // Group them by group letter
  const byGroup = {};
  for (const m of groupMatches) {
    const g = m.group || 'UNKNOWN';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  }

  let updated = 0;

  for (const [group, matches] of Object.entries(byGroup)) {
    // Sort by date ascending (already sorted but just in case)
    matches.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    const total = matches.length;
    console.log(`\nGroup ${group}: ${total} matches`);

    if (total !== 6) {
      console.warn(`  ⚠ Expected 6 matches for group ${group}, got ${total}. Assigning matchday by thirds.`);
    }

    for (let i = 0; i < matches.length; i++) {
      let matchday;
      if (total === 6) {
        // Standard 4-team group: 2 matches per matchday
        matchday = Math.floor(i / 2) + 1; // 0,1 → 1 | 2,3 → 2 | 4,5 → 3
      } else {
        // Fallback: divide evenly into thirds
        matchday = Math.floor((i / total) * 3) + 1;
      }

      const m = matches[i];
      console.log(`  Jornada ${matchday} → Match ${m.matchNumber || m._id} (${new Date(m.matchDate).toISOString().slice(0, 10)})`);

      await Match.updateOne({ _id: m._id }, { $set: { matchday } });
      updated++;
    }
  }

  console.log(`\n✓ Done. Updated ${updated} matches with matchday field.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
