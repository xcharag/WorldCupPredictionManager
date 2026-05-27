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
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    dbName,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected — mongoose will attempt to reconnect automatically');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });
};

module.exports = connectDB;
