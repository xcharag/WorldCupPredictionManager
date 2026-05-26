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

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    existing.isAdmin = true;
    await existing.save();
    console.log(`Admin flag set on existing user: ${existing.email}`);
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
