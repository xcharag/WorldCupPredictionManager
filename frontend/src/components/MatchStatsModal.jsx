import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import MinioImage from './MinioImage'

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
    <div className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border transition-colors ${
      isWinner
        ? 'bg-brand-primary/10 border-brand-primary/40'
        : 'bg-brand-elevated border-transparent'
    }`}>
      {flag && <span className="text-2xl leading-none">{flag}</span>}
      <span className={`text-[11px] font-semibold truncate w-full text-center leading-none ${isWinner ? 'text-brand-primary' : 'text-brand-muted'}`}>
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
      <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0">
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

export default function MatchStatsModal({ match, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Lock body scroll for the duration of the modal
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    api.get(`/predictions/stats/${match._id}`)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false))
  }, [match._id])

  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam
  const realWinner = match.homeScore > match.awayScore ? 'home'
    : match.homeScore < match.awayScore ? 'away' : 'draw'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-brand-surface rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '88dvh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide pt-0.5">
              {STAGE_LABELS[match.stage] || match.stage}
              {match.group ? ` · Grupo ${match.group}` : ''}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 -mt-1 -mr-1 rounded-full text-brand-muted active:bg-brand-elevated flex-shrink-0"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Teams + score */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-4xl leading-none">{homeTeam?.flag || '🏳️'}</span>
              <span className="text-sm font-bold text-center leading-tight">{homeTeam?.shortName || '?'}</span>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-4xl font-black tabular-nums leading-none">{match.homeScore} – {match.awayScore}</span>
              <span className="text-[10px] text-brand-muted mt-1.5 uppercase tracking-wide">Final</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-4xl leading-none">{awayTeam?.flag || '🏳️'}</span>
              <span className="text-sm font-bold text-center leading-tight">{awayTeam?.shortName || '?'}</span>
            </div>
          </div>
        </div>

        {/* Stats section — never scrolls */}
        {loading ? (
          <div className="px-5 pb-5 flex-shrink-0 space-y-3 animate-pulse">
            <div className="h-3 w-24 rounded bg-brand-elevated mx-auto" />
            <div className="flex gap-2">
              <div className="flex-1 h-24 rounded-2xl bg-brand-elevated" />
              <div className="flex-1 h-24 rounded-2xl bg-brand-elevated" />
              <div className="flex-1 h-24 rounded-2xl bg-brand-elevated" />
            </div>
            <div className="flex gap-2">
              {[1,2,3,4].map(i => <div key={i} className="h-8 w-14 rounded-xl bg-brand-elevated" />)}
            </div>
          </div>
        ) : !stats || stats.total === 0 ? (
          <div className="px-5 py-8 text-center flex-shrink-0">
            <p className="text-brand-muted text-sm">No hay pronosticos para este partido.</p>
          </div>
        ) : (
          <>
            <div className="px-5 pb-4 flex-shrink-0 space-y-3">
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

              {/* Top predicted scores */}
              {stats.scores.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {stats.scores.slice(0, 10).map(s => (
                    <div
                      key={`${s.home}-${s.away}`}
                      className="flex-shrink-0 flex flex-col items-center bg-brand-elevated rounded-xl px-3 py-1.5"
                    >
                      <span className="font-bold text-sm tabular-nums">{s.home}–{s.away}</span>
                      <span className="text-[10px] text-brand-muted">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User list — scrolls inside the modal */}
            <div className="border-t border-brand-border flex-shrink-0 px-5 py-2.5">
              <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">
                Todos los pronosticos
              </span>
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-6">
              {stats.predictions.map((p, i) => (
                <PredictionRow
                  key={i}
                  p={p}
                  realHome={match.homeScore}
                  realAway={match.awayScore}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
