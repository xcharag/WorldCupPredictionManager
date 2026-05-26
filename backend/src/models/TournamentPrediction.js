const mongoose = require('mongoose');

const tournamentPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Null means global prediction shared across all groups.
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    champion: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    runnerUp: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    topScorer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    topAssister: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    mostYellowCards: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    mostRedCards: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    points: { type: Number, default: null }, // null = not yet calculated
  },
  { timestamps: true }
);

// Unique tournament prediction per user + group
tournamentPredictionSchema.index({ user: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('TournamentPrediction', tournamentPredictionSchema);
