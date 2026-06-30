/**
 * Migration: stamp existing WC2026 data into the new Tournament/Season model.
 *
 * Safe to run multiple times — idempotent.
 *
 * Run: npm run migrate:multi-tournament
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Season = require('../models/Season');
const Match = require('../models/Match');
const Group = require('../models/Group');

const WC2026_STAGES = [
  { key: 'group_stage',  name: 'Fase de grupos',    order: 1, isKnockout: false },
  { key: 'round_of_32', name: 'Ronda de 32',        order: 2, isKnockout: true },
  { key: 'round_of_16', name: 'Octavos de final',   order: 3, isKnockout: true },
  { key: 'quarter_final',name: 'Cuartos de final',  order: 4, isKnockout: true },
  { key: 'semi_final',  name: 'Semifinales',         order: 5, isKnockout: true },
  { key: 'third_place', name: 'Tercer puesto',       order: 6, isKnockout: true },
  { key: 'final',       name: 'Final',               order: 7, isKnockout: true },
];

const WC2026_TOURNAMENT_FIELDS = [
  { key: 'champion',      label: 'Campeón',          type: 'team',   points: 50, enabled: true },
  { key: 'runnerUp',      label: 'Subcampeón',       type: 'team',   points: 30, enabled: true },
  { key: 'topScorer',     label: 'Máx. goleador',    type: 'player', points: 30, enabled: true },
  { key: 'topAssister',   label: 'Máx. asistidor',   type: 'player', points: 20, enabled: true },
  { key: 'mostYellowCards',label:'Más amarillas',    type: 'player', points: 20, enabled: true },
  { key: 'mostRedCards',  label: 'Más rojas',        type: 'player', points: 20, enabled: true },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Create or find the Tournament document
  let tournament = await Tournament.findOne({ slug: 'fifa-world-cup' });
  if (!tournament) {
    tournament = await Tournament.create({
      name: 'FIFA World Cup',
      slug: 'fifa-world-cup',
      sport: 'football',
      type: 'official',
      icon: '🏆',
      isPublic: true,
      createdBy: null,
    });
    console.log('Created Tournament: FIFA World Cup');
  } else {
    console.log('Tournament already exists:', tournament.name);
  }

  // 2. Create or find the Season document
  let season = await Season.findOne({ tournament: tournament._id, year: 2026 });
  if (!season) {
    season = await Season.create({
      tournament: tournament._id,
      name: 'FIFA World Cup 2026',
      year: 2026,
      status: 'active',
      apiProvider: 'football-data',
      apiTournamentId: process.env.FD_TOURNAMENT_ID || '2000',
      stages: WC2026_STAGES,
      teams: [],
      defaultScoringConfig: {
        correctOutcome: 2,
        oneTeamCorrect: 1,
        exactScoreBonus: 3,
        knockoutWinnerBonus: 3,
        extraTimeBonus: 0,
        penaltiesBonus: 0,
      },
      tournamentPredictionFields: WC2026_TOURNAMENT_FIELDS,
      createdBy: null,
    });
    console.log('Created Season: FIFA World Cup 2026');
  } else {
    console.log('Season already exists:', season.name);
  }

  // 3. Stamp season on all matches that don't have one
  const matchResult = await Match.updateMany(
    { season: null },
    { $set: { season: season._id } }
  );
  console.log(`Stamped season on ${matchResult.modifiedCount} matches`);

  // 4. Stamp season on all groups that don't have one
  const groupResult = await Group.updateMany(
    { season: null },
    { $set: { season: season._id } }
  );
  console.log(`Stamped season on ${groupResult.modifiedCount} groups`);

  console.log('\nMigration complete.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
