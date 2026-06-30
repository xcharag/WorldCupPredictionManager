const mongoose = require('mongoose');

const scoringConfigSchema = new mongoose.Schema(
  {
    correctOutcome: { type: Number, default: 2 },     // +N for correct W/D/L
    oneTeamCorrect: { type: Number, default: 1 },     // +N when exactly one team score matches
    exactScoreBonus: { type: Number, default: 3 },    // +N on top of correctOutcome for exact score
    knockoutWinnerBonus: { type: Number, default: 3 },// +N when user predicted draw + correct knockout winner
    extraTimeBonus: { type: Number, default: 0 },     // +N bonus if user predicted ET and it went to ET
    penaltiesBonus: { type: Number, default: 0 },     // +N bonus if user predicted penalties and it went to pens
  },
  { _id: false }
);

const stageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },       // e.g. "group_stage", "final", or custom
    name: { type: String, required: true },      // display label
    order: { type: Number, default: 0 },         // for sorting
    isKnockout: { type: Boolean, default: false },// shows winner pick in prediction form
  },
  { _id: false }
);

// User-defined bonus prediction fields (e.g. champion, top scorer, or custom)
const predictionFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },             // "champion", "top_scorer", or any custom key
    label: { type: String, required: true },           // "Campeón", "Goleador", etc.
    type: { type: String, enum: ['team', 'player', 'text'], default: 'text' },
    points: { type: Number, default: 10 },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const seasonSchema = new mongoose.Schema(
  {
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    name: { type: String, required: true, trim: true },  // "FIFA World Cup 2026"
    year: { type: Number },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'finished', 'archived'],
      default: 'upcoming',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // API integration — only for official tournaments
    apiProvider: { type: String, enum: ['football-data', null], default: null },
    apiTournamentId: { type: String, default: null }, // e.g. "2000" for WC in football-data.org

    // Custom tournament team roster (free-text names)
    teams: [{ type: String, trim: true }],

    // Phase/stage definitions (ordered)
    stages: [stageSchema],

    // Default scoring — groups inherit this unless they override
    defaultScoringConfig: { type: scoringConfigSchema, default: () => ({}) },

    // Bonus prediction fields shown to all groups in this season
    tournamentPredictionFields: [predictionFieldSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Season', seasonSchema);
