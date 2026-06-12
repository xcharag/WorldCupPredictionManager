import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import MinioImage from '../components/MinioImage'

const STAGE_LABELS = {
  group_stage: 'Fase de grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinal',
  third_place: 'Tercer puesto',
  final: 'Final',
}

function OutcomeCard({ label, flag, count, pct, isWinner }) {
  return (
    <div className={`flex-1 flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border ${
      isWinner ? 'bg-brand-primary/10 border-brand-primary/40' : 'bg-brand-elevated border-transparent'
    }`}>
      {flag && <span className="text-3xl leading-none">{flag}</span>}
      <span className={`text-xs font-semibold truncate w-full text-center leading-none mt-0.5 ${isWinner ? 'text-brand-primary' : 'text-brand-muted'}`}>
        {label}
      </span>
      <span className={`text-2xl font-black leading-none ${isWinner ? 'text-brand-primary' : 'text-brand-text'}`}>
        {pct}%
      </span>
      <span className="text-[10px] text-brand-muted leading-none">{count} pred</span>
    </div>
  )
}

function PredictionRow({ p, realHome, realAway }) {
  const navigate = useNavigate()
  const isExact = p.predictedHomeScore === realHome && p.predictedAwayScore === realAway
  const predWinner = p.predictedHomeScore > p.predictedAwayScore ? 'home'
    : p.predictedHomeScore < p.predictedAwayScore ? 'away' : 'draw'
  const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw'
  const correct = predWinner === realWinner

  const badgeClass = isExact
    ? 'text-brand-primary bg-brand-primary/10'
    : correct
    ? 'text-blue-400 bg-blue-500/10'
    : 'text-brand-muted bg-brand-elevated'
  const badgeLabel = isExact ? 'Exacto' : correct ? 'Resultado' : 'Fallo'
  const initials = p.user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <button
      className="w-full flex items-center gap-3 py-3 border-b border-brand-border last:border-0 active:bg-brand-elevated text-left"
      onClick={() => navigate(`/users/${p.user._id}`)}
    >
      <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0">
        {p.user?.avatar ? (
          <MinioImage
            src={p.user.avatar}
            alt={p.user.nickname}
            className="w-full h-full object-cover"
            fallback={<span className="text-xs font-bold text-brand-primary">{initials}</span>}
          />
        ) : (
          <span className="text-xs font-bold text-brand-primary">{initials}</span>
        )}
      </div>
      <span className="flex-1 text-sm font-semibold truncate min-w-0">
        {p.user?.nickname || p.user?.name}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold tabular-nums">{p.predictedHomeScore} – {p.predictedAwayScore}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>
          {badgeLabel}
        </span>
        <span className={`text-xs font-bold w-7 text-right tabular-nums ${p.points > 0 ? 'text-brand-primary' : 'text-brand-muted'}`}>
          {p.points !== null && p.points !== undefined ? `+${p.points}` : '—'}
        </span>
      </div>
    </button>
  )
}

export default function MatchStats() {
  const { matchId } = useParams()
  const location = useLocation()
  const match = location.state?.match

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scoreFilter, setScoreFilter] = useState(null) // `${home}-${away}` or null

  useEffect(() => {
    api.get(`/predictions/stats/${matchId}`)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false))
  }, [matchId])

  const homeTeam = match?.homeTeam
  const awayTeam = match?.awayTeam
  const realWinner = match
    ? match.homeScore > match.awayScore ? 'home'
      : match.homeScore < match.awayScore ? 'away' : 'draw'
    : null

  const subtitle = match
    ? `${STAGE_LABELS[match.stage] || match.stage}${match.group ? ` · Grupo ${match.group}` : ''}`
    : ''

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Estadísticas" subtitle={subtitle} />

      <div className="px-4 pt-5 space-y-5">
        {/* Match score card */}
        {match && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-5xl leading-none">{homeTeam?.flag || '🏳️'}</span>
                <span className="text-sm font-bold text-center">{homeTeam?.shortName || '?'}</span>
              </div>
              <div className="flex flex-col items-center px-4">
                <span className="text-4xl font-black tabular-nums leading-none">{match.homeScore} – {match.awayScore}</span>
                <span className="text-[10px] text-brand-muted mt-2 uppercase tracking-wide">Final</span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-5xl leading-none">{awayTeam?.flag || '🏳️'}</span>
                <span className="text-sm font-bold text-center">{awayTeam?.shortName || '?'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-3 w-24 rounded bg-brand-elevated mx-auto" />
            <div className="flex gap-2">
              <div className="flex-1 h-28 rounded-2xl bg-brand-elevated" />
              <div className="flex-1 h-28 rounded-2xl bg-brand-elevated" />
              <div className="flex-1 h-28 rounded-2xl bg-brand-elevated" />
            </div>
            <div className="flex gap-2">
              {[1,2,3,4].map(i => <div key={i} className="h-9 w-14 rounded-xl bg-brand-elevated" />)}
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-elevated flex-shrink-0" />
                <div className="flex-1 h-4 rounded bg-brand-elevated" />
                <div className="w-20 h-4 rounded bg-brand-elevated" />
              </div>
            ))}
          </div>
        ) : !stats || stats.total === 0 ? (
          <div className="card text-center py-8">
            <p className="text-brand-muted">No hay pronosticos para este partido.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-brand-muted text-center">
              {stats.total} pronostico{stats.total !== 1 ? 's' : ''}
            </p>

            {/* Outcome cards */}
            <div className="flex gap-2">
              <OutcomeCard
                label={homeTeam?.shortName || 'Local'}
                flag={homeTeam?.flag}
                count={stats.homeWin.count}
                pct={stats.homeWin.pct}
                isWinner={realWinner === 'home'}
              />
              <OutcomeCard
                label="Empate"
                count={stats.draw.count}
                pct={stats.draw.pct}
                isWinner={realWinner === 'draw'}
              />
              <OutcomeCard
                label={awayTeam?.shortName || 'Visita'}
                flag={awayTeam?.flag}
                count={stats.awayWin.count}
                pct={stats.awayWin.pct}
                isWinner={realWinner === 'away'}
              />
            </div>

            {/* Top predicted scores — doubles as filter for the list below */}
            {stats.scores.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
                  Resultados más pronosticados
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {stats.scores.slice(0, 10).map(s => {
                    const key = `${s.home}-${s.away}`
                    const active = scoreFilter === key
                    return (
                      <button
                        key={key}
                        onClick={() => setScoreFilter(active ? null : key)}
                        className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 border transition-colors ${
                          active
                            ? 'bg-brand-primary/10 border-brand-primary/40'
                            : 'bg-brand-elevated border-transparent'
                        }`}
                      >
                        <span className={`font-bold text-sm tabular-nums ${active ? 'text-brand-primary' : ''}`}>
                          {s.home}–{s.away}
                        </span>
                        <span className={`text-[10px] ${active ? 'text-brand-primary' : 'text-brand-muted'}`}>
                          {s.pct}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* User predictions list */}
            {(() => {
              const visible = scoreFilter
                ? stats.predictions.filter(p =>
                    `${p.predictedHomeScore}-${p.predictedAwayScore}` === scoreFilter
                  )
                : stats.predictions
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">
                      Todos los pronosticos
                    </p>
                    {scoreFilter && (
                      <button
                        onClick={() => setScoreFilter(null)}
                        className="text-[11px] text-brand-primary font-semibold"
                      >
                        Ver todos
                      </button>
                    )}
                  </div>
                  <div className="bg-brand-surface rounded-2xl border border-brand-border px-4">
                    {visible.length > 0 ? visible.map((p, i) => (
                      <PredictionRow
                        key={i}
                        p={p}
                        realHome={match.homeScore}
                        realAway={match.awayScore}
                      />
                    )) : (
                      <p className="text-brand-muted text-sm text-center py-6">
                        Nadie pronosticó {scoreFilter?.replace('-', ' – ')}.
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
