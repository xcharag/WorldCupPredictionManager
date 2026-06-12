const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nickname: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    avatar: { type: String, default: '' },
    favoriteTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    isAdmin: { type: Boolean, default: false },
    notificationPreferences: {
      type: [{ type: String, enum: ['24h', '6h', '4h', '1h'] }],
      default: [],
      validate: {
        validator: (v) => v.length <= 2,
        message: 'Máximo 2 preferencias de notificación permitidas',
      },
    },
    pushNotificationsEnabled: { type: Boolean, default: false },
    // Which time-before-kickoff windows should trigger a push reminder (unpredicted matches only)
    pushReminderPreferences: {
      type: [{ type: String, enum: ['24h', '6h', '4h', '1h'] }],
      default: ['1h'],
    },
    // Each entry is a full Web Push subscription object { endpoint, expirationTime, keys }
    pushSubscriptions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Privacy: whether other users (group creators) can send group invites to this user
    acceptGroupInvites: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Note: Indexes are auto-created by unique: true in schema definition
// No need for explicit userSchema.index() calls to avoid duplicates

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
