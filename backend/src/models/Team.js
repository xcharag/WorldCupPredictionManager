const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true, maxlength: 3 },
    flag: { type: String, default: '🏳️' },
    fifaCode: { type: String, trim: true, uppercase: true },
    group: { type: String, trim: true, uppercase: true },
    confederation: {
      type: String,
      enum: ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'],
    },
    sportsdbId: { type: String, trim: true },
    footballDataId: { type: String, trim: true },
    badgeUrl: { type: String, trim: true },
    jerseyUrl: { type: String, trim: true },
    fanartUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
