/**
 * Seed script: creates the admin user.
 * Run: node src/seeds/admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

async function seed() {
  const dbName = resolveDbName(process.env.MONGODB_URI || '');
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  const { ADMIN_NAME, ADMIN_NICKNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  // Match by email OR nickname — either one may have drifted from .env
  // independently, and the nickname index is unique so a stale match here
  // would otherwise collide with the insert below.
  const orClauses = [{ email: ADMIN_EMAIL }];
  if (ADMIN_NICKNAME) orClauses.push({ nickname: ADMIN_NICKNAME.toLowerCase() });
  const existing = await User.findOne({ $or: orClauses }).select('+password');

  if (existing) {
    existing.isAdmin = true;
    existing.email = ADMIN_EMAIL;
    if (ADMIN_NICKNAME) existing.nickname = ADMIN_NICKNAME;
    existing.password = ADMIN_PASSWORD; // re-synced from .env on every run
    await existing.save();
    console.log(`Admin synced from .env: ${existing.email} (nickname: ${existing.nickname}, password reset)`);
  } else {
    const admin = await User.create({
      name: ADMIN_NAME || 'Admin',
      nickname: ADMIN_NICKNAME || 'admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      isEmailVerified: true,
      isAdmin: true,
    });
    console.log(`Admin user created: ${admin.email} (nickname: ${admin.nickname})`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
