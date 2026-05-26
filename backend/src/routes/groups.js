const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/groups — get current user's groups
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('creator', 'name nickname')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups — create group
router.post(
  '/',
  protect,
  [body('name').trim().notEmpty().withMessage('Group name required').isLength({ max: 50 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const group = await Group.create({ name: req.body.name, creator: req.user._id, members: [req.user._id] });
      await group.populate('creator', 'name nickname');
      res.status(201).json(group);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/groups/:id — get group details
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'name nickname avatar')
      .populate('members', 'name nickname avatar');

    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.some((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    res.json(group);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/groups/join/:inviteCode — get group info by invite code (no auth required for preview)
router.get('/join/:inviteCode', async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode })
      .populate('creator', 'name nickname')
      .select('name creator members inviteCode');
    if (!group) return res.status(404).json({ message: 'Invite link not found' });
    res.json({ _id: group._id, name: group.name, creator: group.creator, memberCount: group.members.length });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups/join/:inviteCode — join group
router.post('/join/:inviteCode', protect, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!group) return res.status(404).json({ message: 'Invite link not found' });

    const alreadyMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (alreadyMember) return res.json({ message: 'Already a member', group });

    group.members.push(req.user._id);
    await group.save();
    await group.populate('creator', 'name nickname');
    res.json({ message: 'Joined successfully!', group });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/groups/:id/invite-user — invite existing user by nickname
router.post('/:id/invite-user', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can invite users' });
    }

    const { nickname } = req.body;
    const invitee = await User.findOne({ nickname: nickname?.toLowerCase() });
    if (!invitee) return res.status(404).json({ message: `User @${nickname} not found` });

    if (group.members.some((m) => m.toString() === invitee._id.toString())) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    group.members.push(invitee._id);
    await group.save();
    res.json({ message: `@${nickname} added to the group!` });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/groups/:id/members/:userId — remove member (creator only)
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can remove members' });
    }

    if (req.params.userId === group.creator.toString()) {
      return res.status(400).json({ message: 'Cannot remove the creator from the group' });
    }

    const before = group.members.length;
    group.members = group.members.filter((m) => m.toString() !== req.params.userId);
    if (group.members.length === before) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    await group.save();
    res.json({ message: 'Member removed successfully' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/groups/:id — delete group (creator only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can delete this group' });
    }

    await Group.findByIdAndDelete(group._id);
    res.json({ message: 'Group deleted successfully' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/groups/:id/invite-link
router.get('/:id/invite-link', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member' });
    }
    const link = `${process.env.FRONTEND_URL}/join/${group.inviteCode}`;
    res.json({ link, inviteCode: group.inviteCode });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/groups/:id/leave
router.delete('/:id/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Creator cannot leave — delete the group instead' });
    }

    group.members = group.members.filter((m) => m.toString() !== req.user._id.toString());
    await group.save();
    res.json({ message: 'Left group' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
