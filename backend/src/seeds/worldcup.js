/**
 * Seed script: populates 2026 FIFA World Cup teams.
 * Run: node src/seeds/worldcup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

const TEAMS = [
  // UEFA (16)
  { name: 'Alemania', shortName: 'GER', flag: '🇩🇪', fifaCode: 'GER', confederation: 'UEFA' },
  { name: 'Francia', shortName: 'FRA', flag: '🇫🇷', fifaCode: 'FRA', confederation: 'UEFA' },
  { name: 'España', shortName: 'ESP', flag: '🇪🇸', fifaCode: 'ESP', confederation: 'UEFA' },
  { name: 'Portugal', shortName: 'POR', flag: '🇵🇹', fifaCode: 'POR', confederation: 'UEFA' },
  { name: 'Inglaterra', shortName: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', fifaCode: 'ENG', confederation: 'UEFA' },
  { name: 'Países Bajos', shortName: 'NED', flag: '🇳🇱', fifaCode: 'NED', confederation: 'UEFA' },
  { name: 'Bélgica', shortName: 'BEL', flag: '🇧🇪', fifaCode: 'BEL', confederation: 'UEFA' },
  { name: 'Croacia', shortName: 'CRO', flag: '🇭🇷', fifaCode: 'CRO', confederation: 'UEFA' },
  { name: 'Suiza', shortName: 'SUI', flag: '🇨🇭', fifaCode: 'SUI', confederation: 'UEFA' },
  { name: 'Austria', shortName: 'AUT', flag: '🇦🇹', fifaCode: 'AUT', confederation: 'UEFA' },
  { name: 'Turquía', shortName: 'TUR', flag: '🇹🇷', fifaCode: 'TUR', confederation: 'UEFA' },
  { name: 'Escocia', shortName: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', fifaCode: 'SCO', confederation: 'UEFA' },
  { name: 'Noruega', shortName: 'NOR', flag: '🇳🇴', fifaCode: 'NOR', confederation: 'UEFA' },
  { name: 'Suecia', shortName: 'SWE', flag: '🇸🇪', fifaCode: 'SWE', confederation: 'UEFA' },
  { name: 'Chequia', shortName: 'CZE', flag: '🇨🇿', fifaCode: 'CZE', confederation: 'UEFA' },
  { name: 'Bosnia y Herzegovina', shortName: 'BIH', flag: '🇧🇦', fifaCode: 'BIH', confederation: 'UEFA' },

  // CONMEBOL (6)
  { name: 'Brasil', shortName: 'BRA', flag: '🇧🇷', fifaCode: 'BRA', confederation: 'CONMEBOL' },
  { name: 'Argentina', shortName: 'ARG', flag: '🇦🇷', fifaCode: 'ARG', confederation: 'CONMEBOL' },
  { name: 'Colombia', shortName: 'COL', flag: '🇨🇴', fifaCode: 'COL', confederation: 'CONMEBOL' },
  { name: 'Uruguay', shortName: 'URU', flag: '🇺🇾', fifaCode: 'URU', confederation: 'CONMEBOL' },
  { name: 'Ecuador', shortName: 'ECU', flag: '🇪🇨', fifaCode: 'ECU', confederation: 'CONMEBOL' },
  { name: 'Paraguay', shortName: 'PAR', flag: '🇵🇾', fifaCode: 'PAR', confederation: 'CONMEBOL' },

  // CONCACAF (6)
  { name: 'Estados Unidos', shortName: 'USA', flag: '🇺🇸', fifaCode: 'USA', confederation: 'CONCACAF' },
  { name: 'México', shortName: 'MEX', flag: '🇲🇽', fifaCode: 'MEX', confederation: 'CONCACAF' },
  { name: 'Canadá', shortName: 'CAN', flag: '🇨🇦', fifaCode: 'CAN', confederation: 'CONCACAF' },
  { name: 'Panamá', shortName: 'PAN', flag: '🇵🇦', fifaCode: 'PAN', confederation: 'CONCACAF' },
  { name: 'Haití', shortName: 'HAI', flag: '🇭🇹', fifaCode: 'HAI', confederation: 'CONCACAF' },
  { name: 'Curazao', shortName: 'CUW', flag: '🇨🇼', fifaCode: 'CUW', confederation: 'CONCACAF' },

  // CAF (10)
  { name: 'Marruecos', shortName: 'MAR', flag: '🇲🇦', fifaCode: 'MAR', confederation: 'CAF' },
  { name: 'Senegal', shortName: 'SEN', flag: '🇸🇳', fifaCode: 'SEN', confederation: 'CAF' },
  { name: 'Egipto', shortName: 'EGY', flag: '🇪🇬', fifaCode: 'EGY', confederation: 'CAF' },
  { name: 'Ghana', shortName: 'GHA', flag: '🇬🇭', fifaCode: 'GHA', confederation: 'CAF' },
  { name: 'Costa de Marfil', shortName: 'CIV', flag: '🇨🇮', fifaCode: 'CIV', confederation: 'CAF' },
  { name: 'Sudáfrica', shortName: 'RSA', flag: '🇿🇦', fifaCode: 'RSA', confederation: 'CAF' },
  { name: 'Argelia', shortName: 'ALG', flag: '🇩🇿', fifaCode: 'ALG', confederation: 'CAF' },
  { name: 'Túnez', shortName: 'TUN', flag: '🇹🇳', fifaCode: 'TUN', confederation: 'CAF' },
  { name: 'Cabo Verde', shortName: 'CPV', flag: '🇨🇻', fifaCode: 'CPV', confederation: 'CAF' },
  { name: 'República Democrática del Congo', shortName: 'COD', flag: '🇨🇩', fifaCode: 'COD', confederation: 'CAF' },

  // AFC (9)
  { name: 'Japón', shortName: 'JPN', flag: '🇯🇵', fifaCode: 'JPN', confederation: 'AFC' },
  { name: 'Corea del Sur', shortName: 'KOR', flag: '🇰🇷', fifaCode: 'KOR', confederation: 'AFC' },
  { name: 'Australia', shortName: 'AUS', flag: '🇦🇺', fifaCode: 'AUS', confederation: 'AFC' },
  { name: 'Arabia Saudita', shortName: 'KSA', flag: '🇸🇦', fifaCode: 'KSA', confederation: 'AFC' },
  { name: 'Irán', shortName: 'IRN', flag: '🇮🇷', fifaCode: 'IRN', confederation: 'AFC' },
  { name: 'Irak', shortName: 'IRQ', flag: '🇮🇶', fifaCode: 'IRQ', confederation: 'AFC' },
  { name: 'Uzbekistán', shortName: 'UZB', flag: '🇺🇿', fifaCode: 'UZB', confederation: 'AFC' },
  { name: 'Jordania', shortName: 'JOR', flag: '🇯🇴', fifaCode: 'JOR', confederation: 'AFC' },
  { name: 'Catar', shortName: 'QAT', flag: '🇶🇦', fifaCode: 'QAT', confederation: 'AFC' },

  // OFC (1)
  { name: 'Nueva Zelanda', shortName: 'NZL', flag: '🇳🇿', fifaCode: 'NZL', confederation: 'OFC' }
];

async function seed() {
  const dbName = resolveDbName(process.env.MONGODB_URI || '');
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  let created = 0;
  let updated = 0;

  for (const teamData of TEAMS) {
    const existing = await Team.findOne({ fifaCode: teamData.fifaCode });
    if (existing) {
      existing.name = teamData.name;
      existing.shortName = teamData.shortName;
      existing.flag = teamData.flag;
      existing.confederation = teamData.confederation;
      await existing.save();
      updated++;
    } else {
      await Team.create(teamData);
      created++;
      console.log(`  + ${teamData.name}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
