const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    sport: { type: String, default: 'football', trim: true },
    type: { type: String, enum: ['official', 'custom'], required: true },
    icon: { type: String, default: '🏆' }, // emoji or URL
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = seeded by platform
    isPublic: { type: Boolean, default: true }, // custom tournaments are private to their creator's groups by default
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tournament', tournamentSchema);
