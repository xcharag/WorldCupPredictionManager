const https = require('https');
const http = require('http');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const minioClient = require('../config/minio');

const BUCKET = process.env.MINIO_BUCKET || 'worldcup2026';

/**
 * Download a remote image and upload it to Minio.
 * @param {string} sourceUrl   - URL of the image to download
 * @param {string} objectKey   - Destination key inside the Minio bucket (e.g. 'teams/badges/MEX.png')
 * @returns {Promise<string>}  - Public URL of the uploaded image
 */
async function uploadImageFromUrl(sourceUrl, objectKey) {
  const buffer = await downloadImage(sourceUrl);
  const contentType = guessContentType(sourceUrl);

  await minioClient.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const publicBase = process.env.MINIO_PUBLIC_URL || `${process.env.MINIO_ENDPOINT}/${BUCKET}`;
  return `${publicBase.replace(/\/$/, '')}/${objectKey}`;
}

/**
 * Download binary data from a URL, following redirects.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      // Follow up to 3 redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download image (${res.statusCode}): ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Guess content type from URL extension.
 */
function guessContentType(url) {
  const lower = url.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/png'; // TheSportsDB defaults to PNG
}

module.exports = { uploadImageFromUrl };
