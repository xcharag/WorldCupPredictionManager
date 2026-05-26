const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/email');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('nickname')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Nickname must be 3–20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Nickname can only contain letters, numbers, and underscores'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, nickname, email, password, inviteCode } = req.body;

    try {
      const existingNickname = await User.findOne({ nickname: nickname.toLowerCase() });
      if (existingNickname) return res.status(400).json({ message: 'Nickname already taken' });

      const existingEmail = await User.findOne({ email });
      if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const user = await User.create({
        name,
        nickname,
        email,
        password,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000,
      });

      await sendVerificationEmail(user, verificationToken);

      // If inviteCode provided, attach it to response so frontend can redirect to join
      const token = signToken(user._id);
      res.status(201).json({
        token,
        user: { _id: user._id, name: user.name, nickname: user.nickname, email: user.email, isAdmin: user.isAdmin },
        inviteCode: inviteCode || null,
        message: 'Registration successful! Please verify your email.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({
      token,
      user: { _id: user._id, name: user.name, nickname: user.nickname, email: user.email, isAdmin: user.isAdmin, avatar: user.avatar, isEmailVerified: user.isEmailVerified },
    });
  })(req, res, next);
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token required' });

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }
    const token = signToken(user._id);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  })(req, res, next);
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', protect, (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
