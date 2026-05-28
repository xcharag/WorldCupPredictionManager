const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    whatsappLink: { type: String, trim: true, default: '' },
    isPublic: { type: Boolean, default: false },
    acceptJoinRequests: { type: Boolean, default: false },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    inviteCode: { type: String, unique: true, default: () => uuidv4() },
    pendingRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['request', 'invite'], default: 'request' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
