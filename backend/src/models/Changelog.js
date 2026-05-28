const mongoose = require('mongoose');

const changelogSchema = new mongoose.Schema(
  {
    // Semver string used for ordering and "unread" detection on the client
    version: { type: String, required: true, unique: true, trim: true },
    date:    { type: Date, required: true },
    title:   { type: String, required: true, trim: true },
    // Short bullet-point descriptions of what changed
    items:   [{ type: String, trim: true }],
  },
  { timestamps: false }
);

// Return newest first by default
changelogSchema.index({ date: -1 });

module.exports = mongoose.model('Changelog', changelogSchema);
