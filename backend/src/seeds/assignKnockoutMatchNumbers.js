/**
 * Seed: assignKnockoutMatchNumbers.js
 *
 * Assigns matchNumber (73–104) and venue to knockout stage Match documents
 * already in the DB (created by importFootballDataKnockout.js).
 *
 * Matches are located by finding the DB match whose matchDate is closest to
 * the expected UTC kickoff time (within ±90 minutes). Football-data.org times
 * should match official UTC times very closely.
 *
 * Run: node src/seeds/assignKnockoutMatchNumbers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }

// Expected UTC kickoff times, matchNumber, and venue for every knockout match.
// UTC times are computed from the official local times and their UTC offsets.
const KNOCKOUT_FIXTURES = [
  // Round of 32
  { matchNumber: 73,  utc: '2026-06-28T19:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { matchNumber: 74,  utc: '2026-06-29T20:30:00Z', venue: 'Gillette Stadium, Foxborough' },
  { matchNumber: 75,  utc: '2026-06-30T01:00:00Z', venue: 'Estadio BBVA, Guadalupe' },
  { matchNumber: 76,  utc: '2026-06-29T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { matchNumber: 77,  utc: '2026-06-30T21:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { matchNumber: 78,  utc: '2026-06-30T17:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { matchNumber: 79,  utc: '2026-07-01T01:00:00Z', venue: 'Estadio Azteca, Mexico City' },
  { matchNumber: 80,  utc: '2026-07-01T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { matchNumber: 81,  utc: '2026-07-02T00:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { matchNumber: 82,  utc: '2026-07-01T20:00:00Z', venue: 'Lumen Field, Seattle' },
  { matchNumber: 83,  utc: '2026-07-02T23:00:00Z', venue: 'BMO Field, Toronto' },
  { matchNumber: 84,  utc: '2026-07-02T19:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { matchNumber: 85,  utc: '2026-07-03T03:00:00Z', venue: 'BC Place, Vancouver' },
  { matchNumber: 86,  utc: '2026-07-03T22:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { matchNumber: 87,  utc: '2026-07-04T01:30:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  { matchNumber: 88,  utc: '2026-07-03T18:00:00Z', venue: 'AT&T Stadium, Arlington' },
  // Round of 16
  { matchNumber: 89,  utc: '2026-07-04T21:00:00Z', venue: 'Lincoln Financial Field, Philadelphia' },
  { matchNumber: 90,  utc: '2026-07-04T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { matchNumber: 91,  utc: '2026-07-05T20:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { matchNumber: 92,  utc: '2026-07-06T00:00:00Z', venue: 'Estadio Azteca, Mexico City' },
  { matchNumber: 93,  utc: '2026-07-06T19:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { matchNumber: 94,  utc: '2026-07-07T00:00:00Z', venue: 'Lumen Field, Seattle' },
  { matchNumber: 95,  utc: '2026-07-07T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { matchNumber: 96,  utc: '2026-07-07T20:00:00Z', venue: 'BC Place, Vancouver' },
  // Quarterfinals
  { matchNumber: 97,  utc: '2026-07-09T20:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { matchNumber: 98,  utc: '2026-07-10T19:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { matchNumber: 99,  utc: '2026-07-11T21:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { matchNumber: 100, utc: '2026-07-12T01:00:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  // Semifinals
  { matchNumber: 101, utc: '2026-07-14T19:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { matchNumber: 102, utc: '2026-07-15T19:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  // Third place
  { matchNumber: 103, utc: '2026-07-18T21:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  // Final
  { matchNumber: 104, utc: '2026-07-19T19:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
];

const WINDOW_MS = 90 * 60 * 1000; // ±90 minutes

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Load all knockout matches from DB
  const knockoutMatches = await Match.find({
    stage: { $ne: 'group_stage' },
  }).select('_id matchDate stage matchNumber footballDataId');

  console.log(`Found ${knockoutMatches.length} knockout matches in DB`);

  let updated = 0;
  let notFound = 0;

  for (const fixture of KNOCKOUT_FIXTURES) {
    const expectedMs = new Date(fixture.utc).getTime();

    // Find the DB match closest to the expected time, within ±90 min
    let bestMatch = null;
    let bestDiff = Infinity;
    for (const m of knockoutMatches) {
      const diff = Math.abs(new Date(m.matchDate).getTime() - expectedMs);
      if (diff < bestDiff && diff <= WINDOW_MS) {
        bestDiff = diff;
        bestMatch = m;
      }
    }

    if (!bestMatch) {
      console.warn(`  [NOT FOUND] Match #${fixture.matchNumber} (expected ${fixture.utc})`);
      notFound++;
      continue;
    }

    const diffMin = Math.round(bestDiff / 60000);
    await Match.findByIdAndUpdate(bestMatch._id, {
      matchNumber: fixture.matchNumber,
      venue: fixture.venue,
    });

    console.log(
      `  [OK] #${fixture.matchNumber} → DB id ${bestMatch._id} ` +
      `(${bestMatch.stage}, diff ${diffMin}min) → venue: ${fixture.venue}`
    );
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found.`);
  if (notFound > 0) {
    console.warn('Some matches were not found. Check that importFootballDataKnockout.js ran successfully and that the ±90-minute window is sufficient.');
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
