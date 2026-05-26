const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    inviteCode: { type: String, unique: true, default: () => uuidv4() },
  },
  { timestamps: true }
);

// Ensure creator is always in members
groupSchema.pre('save', function (next) {
  const creatorStr = this.creator.toString();
  const memberStrs = this.members.map((m) => m.toString());
  if (!memberStrs.includes(creatorStr)) {
    this.members.push(this.creator);
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
