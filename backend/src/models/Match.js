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
    venue: { type: String, trim: true },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'finished'],
      default: 'scheduled',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Match', matchSchema);
