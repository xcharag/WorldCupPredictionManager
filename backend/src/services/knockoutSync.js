/**
 * Knockout bracket sync — keeps Match documents for round_of_32 onward in
 * step with football-data.org as the bracket resolves (TBD slots get
 * replaced with real teams once group stage / earlier rounds finish).
 *
 * Run daily at 05:00 UTC and right after any match is scored as finished
 * (see scheduler.js), since bracket slots typically resolve within minutes
 * of the deciding match ending.
 */

const Match = require('../models/Match');
const Team = require('../models/Team');
const fd = require('./footballdata');

const STAGE_MAP = {
  GROUP_STAGE: 'group_stage',
  LAST_32: 'round_of_32',
  LAST_16: 'round_of_16',
  QUARTER_FINALS: 'quarter_final',
  SEMI_FINALS: 'semi_final',
  THIRD_PLACE: 'third_place',
  FINAL: 'final',
};

const TLA_REMAP = { URY: 'URU', SAU: 'KSA', DRC: 'COD' };

async function resolveTeam(apiTeamObj) {
  if (!apiTeamObj?.tla) return null;
  const fifaCode = TLA_REMAP[apiTeamObj.tla] || apiTeamObj.tla;
  const team = await Team.findOne({ fifaCode }).select('_id');
  return team?._id || null;
}

/** Fetches WC matches and creates/updates knockout-stage Match docs. */
async function syncKnockoutBracket() {
  if (!process.env.FOOTBALL_DATA_API_KEY) return null;

  const { matches: apiMatches } = await fd.getWCMatches();
  const knockoutMatches = apiMatches.filter((m) => m.stage !== 'GROUP_STAGE');

  let created = 0;
  let resolved = 0;

  for (const apiMatch of knockoutMatches) {
    const stage = STAGE_MAP[apiMatch.stage];
    if (!stage) continue;

    const homeTeamId = await resolveTeam(apiMatch.homeTeam);
    const awayTeamId = await resolveTeam(apiMatch.awayTeam);

    const existing = await Match.findOne({ footballDataId: String(apiMatch.id) });

    if (!existing) {
      const matchData = {
        footballDataId: String(apiMatch.id),
        matchDate: new Date(apiMatch.utcDate),
        stage,
        status: 'scheduled',
        venue: apiMatch.venue || null,
      };
      if (homeTeamId) matchData.homeTeam = homeTeamId;
      if (awayTeamId) matchData.awayTeam = awayTeamId;
      await Match.create(matchData);
      created++;
      continue;
    }

    // Fill in teams once the bracket resolves them (was TBD before).
    const updates = {};
    if (homeTeamId && !existing.homeTeam) updates.homeTeam = homeTeamId;
    if (awayTeamId && !existing.awayTeam) updates.awayTeam = awayTeamId;

    if (Object.keys(updates).length) {
      await Match.updateOne({ _id: existing._id }, { $set: updates });
      resolved++;
    }
  }

  if (created === 0 && resolved === 0) return null;
  return `${created} partidos creados, ${resolved} con equipos resueltos`;
}

module.exports = { syncKnockoutBracket };
