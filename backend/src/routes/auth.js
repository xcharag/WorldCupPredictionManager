const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'El email es requerido' });

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // Always respond the same way to avoid email enumeration
    if (!user || (!user.password && user.googleId)) {
      return res.json({ message: 'Si el email está registrado, recibirás un enlace en los próximos minutos.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user, token);

    res.json({ message: 'Si el email está registrado, recibirás un enlace en los próximos minutos.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al enviar el email' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token y contraseña son requeridos' });
  if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) return res.status(400).json({ message: 'El enlace es inválido o ya expiró' });

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Contraseña restablecida correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al restablecer la contraseña' });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      console.error('[Google OAuth] Callback error:', err.message || err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }
    if (!user) {
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

// PATCH /api/auth/profile
router.patch(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Nickname must be 3–20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Nickname can only contain letters, numbers, and underscores'),
    body('newPassword')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { name, nickname, currentPassword, newPassword } = req.body;

    try {
      const user = await User.findById(req.user._id).select('+password');

      if (name) user.name = name;

      if (nickname) {
        const lower = nickname.toLowerCase();
        if (lower !== user.nickname) {
          const taken = await User.findOne({ nickname: lower, _id: { $ne: user._id } });
          if (taken) return res.status(400).json({ message: 'Nickname already taken' });
          user.nickname = lower;
        }
      }

      if (newPassword) {
        if (!user.password) {
          return res.status(400).json({ message: 'Password change not available for Google accounts' });
        }
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required to set a new one' });
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
        user.password = newPassword;
      }

      await user.save();
      res.json({
        user: {
          _id: user._id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          isAdmin: user.isAdmin,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          googleId: user.googleId,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
