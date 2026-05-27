/**
 * TheSportsDB API client (v1, free tier).
 * Free tier key: 123 — rate limit ~30 req/min.
 * We throttle to 1 request per 2.5 seconds to stay safe.
 */
const https = require('https');

const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_API_KEY || '123'}`;

// Minimum delay between requests (ms) — keeps us well under 30 req/min
const REQUEST_DELAY_MS = 2500;
let lastRequestAt = 0;

/**
 * Make a throttled GET request to TheSportsDB API.
 * @param {string} path  - e.g. '/lookupleague.php?id=4429'
 * @returns {Promise<object>}
 */
async function apiGet(path) {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();

  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from TheSportsDB for ${path}: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Get league details by ID. */
async function getLeague(id) {
  const data = await apiGet(`/lookupleague.php?id=${id}`);
  return data?.leagues?.[0] || null;
}

/** Get all events (matches) for a season of a league. */
async function getEventsBySeason(leagueId, season) {
  const data = await apiGet(`/eventsseason.php?id=${leagueId}&s=${season}`);
  return data?.events || [];
}

/** Lookup full team details by TheSportsDB team ID. */
async function lookupTeam(teamId) {
  const data = await apiGet(`/lookupteam.php?id=${teamId}`);
  return data?.teams?.[0] || null;
}

/** Lookup all players for a team. */
async function lookupPlayersForTeam(teamId) {
  const data = await apiGet(`/lookup_all_players.php?id=${teamId}`);
  return data?.player || [];
}

/** Lookup a single player by ID. */
async function lookupPlayer(playerId) {
  const data = await apiGet(`/lookupplayer.php?id=${playerId}`);
  return data?.players?.[0] || null;
}

module.exports = {
  getLeague,
  getEventsBySeason,
  lookupTeam,
  lookupPlayersForTeam,
  lookupPlayer,
};
