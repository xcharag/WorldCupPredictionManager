const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    position: {
      type: String,
      enum: ['GK', 'DEF', 'MID', 'FWD'],
      required: true,
    },
    number: { type: Number },
    dateOfBirth: { type: Date },
    footballDataId: { type: String, trim: true, index: true, sparse: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
