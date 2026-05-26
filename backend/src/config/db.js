const mongoose = require('mongoose');

function resolveDbName(uri) {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '';
    return process.env.MONGODB_DB || fromPath || 'worldcup2026';
  } catch {
    return process.env.MONGODB_DB || 'worldcup2026';
  }
}

const connectDB = async () => {
  const dbName = resolveDbName(process.env.MONGODB_URI || '');
  const conn = await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
};

module.exports = connectDB;
