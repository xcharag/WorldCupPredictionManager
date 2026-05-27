const Redis = require('ioredis');

let client = null;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null; // give up after 3 attempts
      return Math.min(times * 500, 2000);
    },
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    const isAuthError = err.message && (
      err.message.includes('WRONGPASS') ||
      err.message.includes('NOAUTH') ||
      err.message.includes('invalid username-password')
    );
    if (isAuthError) {
      console.error('[Redis] Authentication failed — cache disabled. Check REDIS_URL credentials.');
      // Stop all reconnection attempts and free the client
      client.disconnect(false);
      client = null;
      return;
    }
    console.error('[Redis] Error:', err.message);
  });

  client.connect().catch((err) => {
    console.warn('[Redis] Could not connect:', err.message, '— running without cache');
    client = null;
  });
} else {
  console.info('[Redis] REDIS_URL not set — cache disabled');
}

/**
 * Get a cached value. Returns null on miss or Redis error.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Set a value with a TTL in seconds. Silently swallows Redis errors.
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 */
async function set(key, value, ttlSeconds) {
  if (!client) return;
  try {
    await client.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Ignore cache write failures — not critical
  }
}

module.exports = { get, set };
