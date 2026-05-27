const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/minio');
const User = require('../models/User');
const Team = require('../models/Team');
const { protect } = require('../middleware/auth');

const BUCKET = process.env.MINIO_BUCKET || 'worldcup2026';
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `${process.env.MINIO_ENDPOINT}/${BUCKET}`;

// Memory storage — we process buffer with sharp before uploading
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Helper: delete old avatar from Minio
async function deleteOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.includes(PUBLIC_URL)) return;
  try {
    const key = avatarUrl.replace(`${PUBLIC_URL}/`, '');
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Non-fatal — old avatar orphaned is acceptable
  }
}

// PUT /api/profile/avatar  — multipart/form-data field: "avatar"
router.put('/avatar', protect, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });

  try {
    // Resize + convert to WebP for consistency / smaller size
    const webpBuffer = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `avatars/${req.user._id}-${Date.now()}.webp`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
      })
    );

    const avatarUrl = `${PUBLIC_URL}/${key}`;

    // Delete old avatar (best-effort)
    const oldUser = await User.findById(req.user._id).select('avatar');
    await deleteOldAvatar(oldUser?.avatar);

    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });

    res.json({ avatar: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// PUT /api/profile/favorite-team
router.put('/favorite-team', protect, async (req, res) => {
  const { teamId } = req.body;

  try {
    if (teamId) {
      const team = await Team.findById(teamId).select('_id');
      if (!team) return res.status(404).json({ message: 'Team not found' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { favoriteTeam: teamId || null },
      { new: true }
    ).populate('favoriteTeam', 'name shortName fifaCode badgeUrl flag');

    res.json({ favoriteTeam: user.favoriteTeam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/profile/me  — returns full profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name nickname email avatar favoriteTeam isEmailVerified isAdmin createdAt notificationPreferences')
      .populate('favoriteTeam', 'name shortName fifaCode badgeUrl flag');
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/profile/notifications
router.get('/notifications', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    res.json({ notificationPreferences: user.notificationPreferences || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/profile/notifications
router.put('/notifications', protect, async (req, res) => {
  const { notificationPreferences } = req.body;
  const VALID = ['24h', '6h', '4h', '1h'];

  if (!Array.isArray(notificationPreferences))
    return res.status(400).json({ message: 'notificationPreferences debe ser un array' });
  if (notificationPreferences.length > 2)
    return res.status(400).json({ message: 'Máximo 2 preferencias permitidas' });
  if (notificationPreferences.some((v) => !VALID.includes(v)))
    return res.status(400).json({ message: 'Valor de preferencia inválido' });

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { notificationPreferences: [...new Set(notificationPreferences)] },
      { new: true }
    ).select('notificationPreferences');
    res.json({ notificationPreferences: user.notificationPreferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
