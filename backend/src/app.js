require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const passport = require('passport');

const connectDB = require('./config/db');
require('./config/passport'); // Register strategies

const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const playerRoutes = require('./routes/players');
const teamRoutes = require('./routes/teams');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const imageRoutes = require('./routes/images');
const { startScheduler } = require('./services/scheduler');

const app = express();

// Trust the first proxy (nginx/Traefik in production)
app.set('trust proxy', 1);

// Connect to MongoDB, then start reminder scheduler
connectDB()
  .then(() => startScheduler())
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(mongoSanitize());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Passport
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));

module.exports = app;
