const mongoose = require('mongoose');

const matchPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Null means global prediction shared across all groups.
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    predictedHomeScore: { type: Number, required: true, min: 0 },
    predictedAwayScore: { type: Number, required: true, min: 0 },
    points: { type: Number, default: null }, // null = not yet calculated
  },
  { timestamps: true }
);

// Unique prediction per user + group + match
matchPredictionSchema.index({ user: 1, group: 1, match: 1 }, { unique: true });

module.exports = mongoose.model('MatchPrediction', matchPredictionSchema);
