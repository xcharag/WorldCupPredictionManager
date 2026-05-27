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
  },
  { timestamps: true }
);

// Indexes for frequently queried fields to prevent timeouts
userSchema.index({ email: 1 });
userSchema.index({ nickname: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
