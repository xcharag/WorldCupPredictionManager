const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendPushToUser } = require('../services/pushNotifications');

/** Fire-and-forget push — never throws */
async function tryPush(user, payload) {
  if (!user?.pushNotificationsEnabled || !(user.pushSubscriptions?.length)) return;
  try { await sendPushToUser(user, payload); } catch { /* non-fatal */ }
}

// ── My groups ─────────────────────────────────────────────────────────────────
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

// ── Public group discovery (MUST be before /:id) ──────────────────────────────
router.get('/public', protect, async (req, res) => {
  try {
    const groups = await Group.find({ isPublic: true })
      .populate('creator', 'name nickname')
      .select('name description creator members acceptJoinRequests pendingRequests')
      .sort({ createdAt: -1 });

    const userId = req.user._id.toString();
    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      creator: g.creator,
      memberCount: g.members.length,
      acceptJoinRequests: g.acceptJoinRequests,
      isMember: g.members.some((m) => m.toString() === userId),
      hasRequested: g.pendingRequests.some(
        (r) => r.type === 'request' && r.user.toString() === userId
      ),
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── My pending invites (MUST be before /:id) ──────────────────────────────────
router.get('/my-pending', protect, async (req, res) => {
  try {
    const groups = await Group.find({
      pendingRequests: { $elemMatch: { user: req.user._id, type: 'invite' } },
    })
      .populate('creator', 'name nickname')
      .select('name creator pendingRequests');

    const userId = req.user._id.toString();
    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      creator: g.creator,
      invite: g.pendingRequests.find(
        (r) => r.user.toString() === userId && r.type === 'invite'
      ),
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Create group ──────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  [body('name').trim().notEmpty().withMessage('Group name required').isLength({ max: 50 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const group = await Group.create({
        name: req.body.name,
        creator: req.user._id,
        members: [req.user._id],
      });
      await group.populate('creator', 'name nickname');
      res.status(201).json(group);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ── Group details ─────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'name nickname avatar')
      .populate('members', 'name nickname avatar')
      .populate('pendingRequests.user', 'name nickname avatar');

    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.some((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    res.json(group);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Join by invite code (preview) ─────────────────────────────────────────────
router.get('/join/:inviteCode', async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode })
      .populate('creator', 'name nickname')
      .select('name creator members inviteCode');
    if (!group) return res.status(404).json({ message: 'Invite link not found' });
    res.json({
      _id: group._id,
      name: group.name,
      creator: group.creator,
      memberCount: group.members.length,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Join by invite code ────────────────────────────────────────────────────────
router.post('/join/:inviteCode', protect, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!group) return res.status(404).json({ message: 'Invite link not found' });

    const alreadyMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (alreadyMember) return res.json({ message: 'Already a member', group });

    // Remove any pending invite/request for this user since they are joining via link
    group.pendingRequests = group.pendingRequests.filter(
      (r) => r.user.toString() !== req.user._id.toString()
    );

    group.members.push(req.user._id);
    await group.save();
    await group.populate('creator', 'name nickname');
    res.json({ message: 'Joined successfully!', group });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Send invite to user by nickname (creates pending invite) ──────────────────
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

    if (invitee.acceptGroupInvites === false) {
      return res.status(403).json({ message: `@${nickname} no acepta invitaciones de grupos` });
    }

    if (group.members.some((m) => m.toString() === invitee._id.toString())) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    const existing = group.pendingRequests.find((r) => r.user.toString() === invitee._id.toString());
    if (existing) {
      // If the user already sent a join request, approve it directly
      if (existing.type === 'request') {
        group.pendingRequests = group.pendingRequests.filter(
          (r) => r.user.toString() !== invitee._id.toString()
        );
        group.members.push(invitee._id);
        await group.save();
        await tryPush(invitee, {
          title: '✅ Solicitud aprobada',
          body: `Fuiste aceptado en el grupo "${group.name}"`,
          url: '/groups',
        });
        return res.json({ message: `@${nickname} tenia solicitud pendiente y fue aceptado.` });
      }
      return res.status(400).json({ message: 'User already has a pending invite' });
    }

    group.pendingRequests.push({ user: invitee._id, type: 'invite' });
    await group.save();

    await tryPush(invitee, {
      title: '👥 Invitacion a grupo',
      body: `@${req.user.nickname} te invito a unirte al grupo "${group.name}"`,
      url: '/groups',
    });

    res.json({ message: `Invitacion enviada a @${nickname}` });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Request to join a public group ────────────────────────────────────────────
router.post('/:id/join-request', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.isPublic) return res.status(403).json({ message: 'This group is not public' });
    if (!group.acceptJoinRequests) {
      return res.status(403).json({ message: 'This group is not accepting join requests' });
    }

    const userId = req.user._id.toString();
    if (group.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ message: 'Already a member' });
    }
    if (group.pendingRequests.some((r) => r.user.toString() === userId)) {
      return res.status(400).json({ message: 'Already have a pending request or invite' });
    }

    group.pendingRequests.push({ user: req.user._id, type: 'request' });
    await group.save();

    // Notify the group creator
    const creator = await User.findById(group.creator)
      .select('pushNotificationsEnabled pushSubscriptions nickname');
    await tryPush(creator, {
      title: '👥 Nueva solicitud de ingreso',
      body: `@${req.user.nickname} quiere unirse a tu grupo "${group.name}"`,
      url: `/groups/${group._id}`,
    });

    res.json({ message: 'Join request sent!' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Cancel my join request ────────────────────────────────────────────────────
router.delete('/:id/join-request', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userId = req.user._id.toString();
    const before = group.pendingRequests.length;
    group.pendingRequests = group.pendingRequests.filter(
      (r) => !(r.user.toString() === userId && r.type === 'request')
    );
    if (group.pendingRequests.length === before) {
      return res.status(404).json({ message: 'No pending request found' });
    }

    await group.save();
    res.json({ message: 'Request cancelled' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Respond to an invite (invited user accepts or declines) ───────────────────
router.post('/:id/my-invite/respond', protect, async (req, res) => {
  const { accept } = req.body;
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userId = req.user._id.toString();
    const inviteIdx = group.pendingRequests.findIndex(
      (r) => r.user.toString() === userId && r.type === 'invite'
    );
    if (inviteIdx === -1) return res.status(404).json({ message: 'No invite found' });

    group.pendingRequests.splice(inviteIdx, 1);
    if (accept) {
      group.members.push(req.user._id);
    }

    await group.save();
    res.json({ message: accept ? 'Joined the group!' : 'Invite declined' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Approve join request (creator only) ───────────────────────────────────────
router.post('/:id/requests/:userId/approve', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can approve requests' });
    }

    const reqIdx = group.pendingRequests.findIndex(
      (r) => r.user.toString() === req.params.userId && r.type === 'request'
    );
    if (reqIdx === -1) return res.status(404).json({ message: 'Request not found' });

    group.pendingRequests.splice(reqIdx, 1);
    group.members.push(req.params.userId);
    await group.save();

    const approvedUser = await User.findById(req.params.userId)
      .select('pushNotificationsEnabled pushSubscriptions');
    await tryPush(approvedUser, {
      title: '✅ Solicitud aprobada',
      body: `Fuiste aceptado en el grupo "${group.name}"`,
      url: `/groups/${group._id}`,
    });

    res.json({ message: 'Request approved' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Reject join request (creator only) ────────────────────────────────────────
router.delete('/:id/requests/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can reject requests' });
    }

    const before = group.pendingRequests.length;
    group.pendingRequests = group.pendingRequests.filter(
      (r) => !(r.user.toString() === req.params.userId && r.type === 'request')
    );
    if (group.pendingRequests.length === before) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await group.save();

    const rejectedUser = await User.findById(req.params.userId)
      .select('pushNotificationsEnabled pushSubscriptions');
    await tryPush(rejectedUser, {
      title: '❌ Solicitud rechazada',
      body: `Tu solicitud para unirte al grupo "${group.name}" fue rechazada`,
      url: '/groups?tab=explore',
    });

    res.json({ message: 'Request rejected' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Remove member (creator only) ──────────────────────────────────────────────
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

// ── Delete group (creator only) ───────────────────────────────────────────────
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

// ── Update group settings (creator only) ──────────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can update this group' });
    }

    const { name, description, whatsappLink, isPublic, acceptJoinRequests } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.length > 50) {
        return res.status(400).json({ message: 'Group name must be 1-50 characters' });
      }
      group.name = trimmed;
    }

    if (description !== undefined) {
      group.description = String(description).trim().slice(0, 300);
    }

    if (whatsappLink !== undefined) {
      const link = String(whatsappLink).trim();
      if (link && !link.startsWith('https://chat.whatsapp.com/')) {
        return res
          .status(400)
          .json({ message: 'El enlace debe empezar con https://chat.whatsapp.com/' });
      }
      group.whatsappLink = link;
    }

    if (isPublic !== undefined) {
      group.isPublic = !!isPublic;
    }

    if (acceptJoinRequests !== undefined) {
      group.acceptJoinRequests = !!acceptJoinRequests;
    }

    // Normalize: acceptJoinRequests only applies when public
    if (!group.isPublic) {
      group.acceptJoinRequests = false;
      // Remove pending join requests (keep invites since those are creator-initiated)
      group.pendingRequests = group.pendingRequests.filter((r) => r.type === 'invite');
    }

    await group.save();
    res.json({
      message: 'Group updated',
      name: group.name,
      description: group.description,
      whatsappLink: group.whatsappLink,
      isPublic: group.isPublic,
      acceptJoinRequests: group.acceptJoinRequests,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Get invite link ───────────────────────────────────────────────────────────
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

// ── Leave group ───────────────────────────────────────────────────────────────
router.delete('/:id/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: 'Creator cannot leave — delete the group instead' });
    }

    group.members = group.members.filter((m) => m.toString() !== req.user._id.toString());
    await group.save();
    res.json({ message: 'Left group' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
