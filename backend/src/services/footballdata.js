/**
 * football-data.org API v4 client
 *
 * Free tier: 10 requests / minute.
 * We enforce a 6.2-second gap between calls to stay comfortably under the limit.
 * All functions return parsed JSON data directly.
 *
 * Env var: FOOTBALL_DATA_API_KEY
 */

const axios = require('axios');

const BASE = 'https://api.football-data.org/v4';
const MIN_DELAY_MS = 6200; // 10 req/min → 6 s min; +200 ms safety buffer

let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiGet(path) {
  const wait = MIN_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const { data } = await axios.get(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY },
    timeout: 15000,
  });
  return data;
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

module.exports = { getWCTeams, getWCMatches, getMatch };
