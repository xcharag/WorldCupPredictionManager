const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    matchNumber: { type: Number },
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    matchDate: { type: Date, required: true },
    stage: {
      type: String,
      enum: [
        'group_stage',
        'round_of_32',
        'round_of_16',
        'quarter_final',
        'semi_final',
        'third_place',
        'final',
      ],
      required: true,
    },
    group: { type: String }, // e.g. "A", "B" — only for group_stage
    matchday: { type: Number, min: 1 }, // 1, 2, or 3 for group_stage; null for knockout
    venue: { type: String, trim: true },
    // Regulation (90 min + stoppage) score — what predictions are graded against.
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    // Live match clock, synced from football-data.org while in_progress.
    minute: { type: Number, default: null },
    injuryTime: { type: Number, default: null },
    // Knockout-only: cumulative score after extra time / penalty shootout (display only, not graded).
    extraTimeHomeScore: { type: Number, default: null },
    extraTimeAwayScore: { type: Number, default: null },
    penaltyHomeScore: { type: Number, default: null },
    penaltyAwayScore: { type: Number, default: null },
    // Knockout-only: who advances when homeScore/awayScore end in a draw (decided by extra time or penalties).
    winner: { type: String, enum: ['home', 'away'], default: null },
    decidedBy: { type: String, enum: ['regular_time', 'extra_time', 'penalties'], default: null },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'finished'],
      default: 'scheduled',
    },
    sportsdbId: { type: String, trim: true },
    footballDataId: { type: String, trim: true },
    thumbUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);
