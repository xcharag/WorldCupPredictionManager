/**
 * football-data.org API v4 client
 *
 * Paid tier: 20 requests / minute.
 * We enforce a 3.1-second gap between calls to stay comfortably under the limit.
 * All functions return parsed JSON data directly.
 *
 * Env var: FOOTBALL_DATA_API_KEY
 */

const axios = require('axios');

const BASE = 'https://api.football-data.org/v4';
const MIN_DELAY_MS = 3100; // 20 req/min → 3 s min; +100 ms safety buffer

let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE', 'EHOSTUNREACH']);

function isRetryable(err) {
  if (err.code && RETRYABLE_CODES.has(err.code)) return true;
  const msg = err.message || '';
  return msg.includes('socket disconnected') || msg.includes('socket hang up') || msg.includes('TLS');
}

async function apiGet(path, retries = 3) {
  const wait = MIN_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(`${BASE}${path}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
        timeout: 15000,
      });
      return data;
    } catch (err) {
      if (attempt < retries && isRetryable(err)) {
        const delay = 2000 * attempt; // 2 s, 4 s
        console.warn(`[footballdata] Retrying ${path} (attempt ${attempt}/${retries}) after ${delay}ms — ${err.message}`);
        await sleep(delay);
        lastRequestAt = Date.now(); // reset throttle so next attempt isn't double-penalised
      } else {
        throw err;
      }
    }
  }
}

/** GET /v4/competitions/WC/teams — 48 WC teams each with their full squad */
function getWCTeams() {
  return apiGet('/competitions/WC/teams');
}

/** GET /v4/competitions/2000/matches?season=2026 — all WC 2026 matches */
function getWCMatches() {
  return apiGet('/competitions/2000/matches?season=2026');
}

/** GET /v4/matches/:id — single match with live score / status */
function getMatch(footballDataId) {
  return apiGet(`/matches/${footballDataId}`);
}

/** GET /v4/competitions/2000/matches?status=LIVE — all currently live WC matches
 *  LIVE is a pseudo-status defined by the API that combines IN_PLAY and PAUSED. */
function getLiveWCMatches() {
  return apiGet('/competitions/2000/matches?status=LIVE');
}

/** GET /v4/competitions/2000/standings — group stage standings for WC 2026 */
function getWCStandings() {
  return apiGet('/competitions/2000/standings');
}

module.exports = { getWCTeams, getWCMatches, getMatch, getLiveWCMatches, getWCStandings };
