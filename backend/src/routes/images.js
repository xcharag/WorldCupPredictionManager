const express = require('express');
const router = express.Router();
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3 = require('../config/minio');
const { protect } = require('../middleware/auth');
const cache = require('../config/redis');

const BUCKET = process.env.MINIO_BUCKET || 'worldcup2026';
const ENDPOINT = (process.env.MINIO_ENDPOINT || '').replace(/\/$/, '');
const PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || `${ENDPOINT}/${BUCKET}`).replace(/\/$/, '');

// Presigned URL expires in 1 hour; cache for 55 min to ensure we never
// serve an already-expired URL even with slight clock drift.
const SIGN_TTL = 3600;       // seconds, passed to S3 signer
const CACHE_TTL = 3300;      // seconds, stored in Redis (55 min)

function extractKey(rawUrl) {
  if (!rawUrl) return null;
  const url = decodeURIComponent(rawUrl);

  // e.g. https://miniodev.xchar.site/worldcup2026/avatars/xxx.webp
  const pfx1 = PUBLIC_URL + '/';
  if (url.startsWith(pfx1)) return url.slice(pfx1.length);

  // e.g. https://miniodev.xchar.site/worldcup2026/avatars/xxx.webp (from ENDPOINT/BUCKET)
  const pfx2 = `${ENDPOINT}/${BUCKET}/`;
  if (url.startsWith(pfx2)) return url.slice(pfx2.length);

  // Already a plain key (no http scheme)
  if (!url.startsWith('http')) return url;

  return null;
}

// GET /api/images/signed?url=FULL_MINIO_URL  or  ?key=OBJECT_KEY
// Returns { url: presignedUrl } valid for 1 hour
router.get('/signed', protect, async (req, res) => {
  const { url, key: rawKey } = req.query;

  let key = rawKey || null;
  if (!key && url) key = extractKey(url);
  if (!key) return res.status(400).json({ message: 'Provide key or url query param' });

  const cacheKey = `img:signed:${key}`;

  // 1. Try Redis cache first
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ url: cached });

  // 2. Generate presigned URL and store in cache
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: SIGN_TTL });
    await cache.set(cacheKey, signedUrl, CACHE_TTL);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error('Presigned URL error:', err);
    res.status(500).json({ message: 'Failed to generate signed URL' });
  }
});

module.exports = router;
