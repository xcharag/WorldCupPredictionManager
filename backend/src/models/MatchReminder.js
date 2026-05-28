const mongoose = require('mongoose');

// Tracks which reminder emails have already been sent
// to avoid duplicates across scheduler runs.
const schema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  match:  { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  timing: { type: String, enum: ['24h', '6h', '4h', '1h', 'push-24h', 'push-6h', 'push-4h', 'push-1h', 'push-30min'], required: true },
  sentAt: { type: Date, default: Date.now },
});

schema.index({ user: 1, match: 1, timing: 1 }, { unique: true });

module.exports = mongoose.model('MatchReminder', schema);
