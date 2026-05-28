/**
 * Seed: changelog entries
 *
 * Usage:
 *   node backend/src/seeds/changelog.js
 *
 * Idempotent — uses upsert by version so it is safe to run multiple times.
 * To add a new entry, append it to the ENTRIES array and re-run the script.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Changelog = require('../models/Changelog');

// ─── Add new versions here ────────────────────────────────────────────────────
const ENTRIES = [
  {
    version: '1.0.0',
    date: new Date('2026-05-01'),
    title: 'Lanzamiento',
    items: [
      'Sistema de predicciones de partidos (resultado exacto)',
      'Pronósticos del torneo: campeón, goleador, máximo asistidor y más',
      'Grupos privados con link de invitación',
      'Tabla de posiciones global y por grupo',
      'Registro e inicio de sesión con Google',
    ],
  },
  {
    version: '1.1.0',
    date: new Date('2026-05-10'),
    title: 'Modo oscuro y recordatorios por email',
    items: [
      'Modo oscuro / claro configurable desde el perfil',
      'Recordatorios por email antes de los partidos (24h, 6h, 4h o 1h antes)',
      'Tabla de posiciones filtrable por grupo y etapa',
      'Avatar personalizable con foto de perfil',
    ],
  },
  {
    version: '1.2.0',
    date: new Date('2026-05-18'),
    title: 'App instalable y tour interactivo',
    items: [
      'Instalá la app en tu pantalla de inicio (Android y iPhone)',
      'Tour interactivo para nuevos usuarios',
      'Perfil de otros usuarios con historial de predicciones',
      'Zoom en fotos de perfil',
    ],
  },
  {
    version: '1.3.0',
    date: new Date('2026-05-28'),
    title: 'Notificaciones push y mejoras de grupo',
    items: [
      'Notificaciones push en el dispositivo (Android y iPhone con app instalada)',
      'Recordatorios diarios automáticos a las 11:00 y 17:30 si tenés predicciones pendientes',
      'Configurá los avisos previos al partido por canal: email, push o ambos',
      'Los creadores de grupo ahora pueden renombrar el grupo',
      'Sección "Novedades" para estar al tanto de las últimas actualizaciones',
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const entry of ENTRIES) {
    await Changelog.findOneAndUpdate(
      { version: entry.version },
      { $set: entry },
      { upsert: true, new: true }
    );
    console.log(`  ✓  v${entry.version} — ${entry.title}`);
  }

  console.log(`\nDone. ${ENTRIES.length} entries upserted.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
