import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import MinioImage from '../components/MinioImage'
import { useAuth } from '../contexts/AuthContext'

const TOURNAMENT_FIELDS = [
  { key: 'champion', label: 'Campeón', icon: '🏆', type: 'team' },
  { key: 'runnerUp', label: 'Subcampeón', icon: '🥈', type: 'team' },
  { key: 'topScorer', label: 'Máx. goleador', icon: '⚽', type: 'player' },
  { key: 'topAssister', label: 'Máx. asistidor', icon: '🎯', type: 'player' },
  { key: 'mostYellowCards', label: 'Más amarillas', icon: '🟨', type: 'player' },
  { key: 'mostRedCards', label: 'Más rojas', icon: '🟥', type: 'player' },
]

function TournamentSection({ tp, isMe }) {
  const [open, setOpen] = useState(false)
  const hasAny = tp && TOURNAMENT_FIELDS.some(f => tp[f.key])

  if (!hasAny) return (
    <div className="card text-center py-5">
      <p className="text-brand-muted text-sm">
        {isMe ? 'Todavía no guardaste tus pronosticos del torneo.' : 'Este usuario no tiene pronosticos del torneo aún.'}
      </p>
    </div>
  )

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full card flex items-center justify-between text-left active:bg-brand-elevated mb-3"
      >
        <div>
          <p className="font-semibold">Pronosticos del torneo</p>
          {tp.points !== null && tp.points !== undefined && (
            <p className="text-xs text-brand-primary mt-0.5">+{tp.points} pts ganados</p>
          )}
        </div>
        {open ? <ChevronUp size={18} className="text-brand-muted" /> : <ChevronDown size={18} className="text-brand-muted" />}
      </button>

      {open && (
        <div className="card mb-3 divide-y divide-brand-border">
          {TOURNAMENT_FIELDS.map(({ key, label, icon, type }) => {
            const val = tp[key]
            return (
              <div key={key} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="text-xs text-brand-muted flex items-center gap-1.5">
                  <span>{icon}</span> {label}
                </span>
                {val ? (
                  <div className="flex items-center gap-1.5 text-right">
                    {type === 'team' && <span className="text-base">{val.flag}</span>}
                    <span className="text-sm font-semibold">
                      {type === 'team' ? val.shortName || val.name : `${val.name}${val.team ? ` (${val.team.shortName || val.team.name})` : ''}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-brand-muted italic">Sin selección</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const STAGE_LABELS = {
  group_stage: 'Fase de grupos',
  round_of_32: 'Ronda de 32',
  round_of_16: 'Octavos de final',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinales',
  third_place: 'Tercer puesto',
  final: 'Final',
}

function outcomeLabel(pred, match) {
  const predHome = pred.predictedHomeScore
  const predAway = pred.predictedAwayScore
  const realHome = match.homeScore
  const realAway = match.awayScore

  const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw'

  const exactScore = predHome === realHome && predAway === realAway
  const correctWinner = predWinner === realWinner

  const isKnockoutDraw = match.stage !== 'group_stage' && realHome === realAway && match.winner
  const predictedKnockoutDraw = predHome === predAway
  const correctKnockoutWinner = isKnockoutDraw && predictedKnockoutDraw && pred.predictedWinner === match.winner

  if (exactScore && correctKnockoutWinner) return { label: 'Perfecto', color: 'text-yellow-400 bg-yellow-400/10' }
  if (exactScore) return { label: 'Exacto', color: 'text-brand-primary bg-brand-primary/10' }
  if (correctWinner && correctKnockoutWinner) return { label: 'Resultado + ganador', color: 'text-blue-400 bg-blue-500/10' }
  if (correctWinner) return { label: 'Resultado', color: 'text-blue-400 bg-blue-500/10' }
  return { label: 'Fallido', color: 'text-brand-muted bg-brand-elevated' }
}

// ── Stats computation ────────────────────────────────────────────────────────
function computeStats(predictions) {
  // Sort chronologically for streak calculation
  const sorted = [...predictions]
    .filter(p => p.match)
    .sort((a, b) => new Date(a.match.matchDate) - new Date(b.match.matchDate))

  let perfectos = 0, exactos = 0, resultadoGanador = 0, resultado = 0, fallidos = 0
  let totalPoints = 0
  let bestStreak = 0, worstStreak = 0, curBest = 0, curWorst = 0

  for (const pred of sorted) {
    const { label } = outcomeLabel(pred, pred.match)
    if (label === 'Perfecto')            perfectos++
    else if (label === 'Exacto')         exactos++
    else if (label === 'Resultado + ganador') resultadoGanador++
    else if (label === 'Resultado')      resultado++
    else                                 fallidos++

    if (pred.points != null) totalPoints += pred.points

    const correct = label !== 'Fallido'
    if (correct) {
      curBest++
      bestStreak = Math.max(bestStreak, curBest)
      curWorst = 0
    } else {
      curWorst++
      worstStreak = Math.max(worstStreak, curWorst)
      curBest = 0
    }
  }

  return { total: sorted.length, perfectos, exactos, resultadoGanador, resultado, fallidos, totalPoints, bestStreak, worstStreak }
}

function StatCell({ label, value, valueColor = 'text-brand-text' }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      <span className={`text-xl font-extrabold leading-none ${valueColor}`}>{value}</span>
      <span className="text-[10px] text-brand-muted text-center leading-tight">{label}</span>
    </div>
  )
}

function StatsCard({ predictions }) {
  const s = useMemo(() => computeStats(predictions), [predictions])
  if (s.total === 0) return null

  return (
    <div className="card">
      <p className="font-semibold text-sm mb-3">Estadísticas</p>

      {/* Outcome breakdown — 3 cols */}
      <div className="grid grid-cols-3 divide-x divide-brand-border border border-brand-border rounded-xl mb-3">
        <StatCell label="Perfectos" value={s.perfectos} valueColor="text-yellow-400" />
        <StatCell label="Exactos" value={s.exactos} valueColor="text-brand-primary" />
        <StatCell label="Resultado" value={s.resultado + s.resultadoGanador} valueColor="text-blue-400" />
      </div>

      {/* Second row — 3 cols */}
      <div className="grid grid-cols-3 divide-x divide-brand-border border border-brand-border rounded-xl mb-3">
        <StatCell label="Fallidos" value={s.fallidos} valueColor="text-brand-muted" />
        <StatCell label="Pts partidos" value={s.totalPoints} valueColor="text-brand-primary" />
        <StatCell label="Total pred." value={s.total} />
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 divide-x divide-brand-border border border-brand-border rounded-xl">
        <div className="flex flex-col items-center gap-0.5 py-2 px-1">
          <div className="flex items-center gap-1">
            <span className="text-xl font-extrabold text-green-400 leading-none">{s.bestStreak}</span>
            <span className="text-base">🔥</span>
          </div>
          <span className="text-[10px] text-brand-muted text-center leading-tight">Racha correcta más larga</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2 px-1">
          <div className="flex items-center gap-1">
            <span className="text-xl font-extrabold text-red-400 leading-none">{s.worstStreak}</span>
            <span className="text-base">❄️</span>
          </div>
          <span className="text-[10px] text-brand-muted text-center leading-tight">Racha fallida más larga</span>
        </div>
      </div>

      {/* Accuracy bar */}
      {s.total > 0 && (() => {
        const pct = Math.round(((s.perfectos + s.exactos + s.resultado + s.resultadoGanador) / s.total) * 100)
        return (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-brand-muted mb-1">
              <span>Precisión (resultado correcto)</span>
              <span className="font-semibold text-brand-text">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-brand-elevated overflow-hidden">
              <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Prediction card ──────────────────────────────────────────────────────────
const DECIDED_BY_LABELS = { penalties: 'Penales', extra_time: 'Tiempo extra' }

function PredictionCard({ pred }) {
  const { match } = pred
  if (!match) return null

  const outcome = outcomeLabel(pred, match)
  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam

  const isKnockout = match.stage && match.stage !== 'group_stage'
  const predictedDraw = pred.predictedHomeScore === pred.predictedAwayScore
  const showDrawPick = isKnockout && predictedDraw && pred.predictedWinner

  const pickedTeam = pred.predictedWinner === 'home'
    ? (homeTeam?.shortName || 'Local')
    : (awayTeam?.shortName || 'Visitante')
  const pickedMethod = DECIDED_BY_LABELS[pred.predictedDecidedBy] || ''

  const isKnockoutDraw = isKnockout && match.homeScore === match.awayScore && match.winner
  const winnerCorrect = isKnockoutDraw && pred.predictedWinner === match.winner

  const borderClass =
    outcome.label === 'Perfecto' ? 'border-l-4 border-yellow-400' :
    outcome.label === 'Exacto'   ? 'border-l-4 border-brand-primary' :
    outcome.label.startsWith('Resultado') ? 'border-l-4 border-blue-400' : ''

  return (
    <div className={`card mb-3 ${borderClass}`}>
      {/* Stage + outcome */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">
          {STAGE_LABELS[match.stage] || match.stage}
        </span>
        <div className="flex items-center gap-1.5">
          {pred.points !== null && (
            <span className="text-xs font-bold text-brand-primary">+{pred.points} pts</span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${outcome.color}`}>
            {outcome.label}
          </span>
        </div>
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {homeTeam?.badgeUrl ? (
            <MinioImage src={homeTeam.badgeUrl} alt={homeTeam.shortName} className="w-6 h-6 object-contain flex-shrink-0"
              fallback={<span className="text-lg leading-none">{homeTeam?.flag}</span>}
            />
          ) : (
            <span className="text-lg leading-none">{homeTeam?.flag || '🏳️'}</span>
          )}
          <span className="text-sm font-semibold truncate">{homeTeam?.shortName || 'Por definir'}</span>
        </div>

        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <span className="text-xs text-brand-muted leading-none">Real</span>
          <span className="text-base font-bold">{match.homeScore} – {match.awayScore}</span>
          <span className="text-xs text-brand-muted leading-none">Pred.</span>
          <span className="text-sm font-semibold text-brand-primary">{pred.predictedHomeScore} – {pred.predictedAwayScore}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate">{awayTeam?.shortName || 'Por definir'}</span>
          {awayTeam?.badgeUrl ? (
            <MinioImage src={awayTeam.badgeUrl} alt={awayTeam.shortName} className="w-6 h-6 object-contain flex-shrink-0"
              fallback={<span className="text-lg leading-none">{awayTeam?.flag}</span>}
            />
          ) : (
            <span className="text-lg leading-none">{awayTeam?.flag || '🏳️'}</span>
          )}
        </div>
      </div>

      {/* Knockout draw pick */}
      {showDrawPick && (
        <div className="mt-2 pt-2 border-t border-brand-border flex items-center justify-between text-xs">
          <span className="text-brand-muted">
            Clasificó: <span className="font-semibold text-brand-text">{pickedTeam}</span>
            {pickedMethod && <span className="text-brand-muted"> · {pickedMethod}</span>}
          </span>
          {isKnockoutDraw && (
            <span className={`font-semibold ${winnerCorrect ? 'text-brand-primary' : 'text-brand-muted'}`}>
              {winnerCorrect ? '+3 pts' : 'Fallido'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stage filter options ─────────────────────────────────────────────────────
const STAGE_FILTER_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'group_stage', label: 'Grupos' },
  { key: 'round_of_32', label: 'R32' },
  { key: 'round_of_16', label: 'R16' },
  { key: 'quarter_final', label: 'QF' },
  { key: 'semi_final', label: 'SF' },
  { key: 'third_place', label: '3°' },
  { key: 'final', label: 'Final' },
]

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UserProfile() {
  const { userId } = useParams()
  const { user: me } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPredictions, setShowPredictions] = useState(false)
  const [stageFilter, setStageFilter] = useState('all')
  const [avatarOpen, setAvatarOpen] = useState(false)

  useEffect(() => {
    api.get(`/users/${userId}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [userId])

  // Must be before early returns — hooks cannot be conditional
  const predictions = data?.predictions || []

  const filteredPredictions = useMemo(() => {
    if (stageFilter === 'all') return predictions
    return predictions.filter(p => p.match?.stage === stageFilter)
  }, [predictions, stageFilter])

  const availableStages = useMemo(() => {
    const used = new Set(predictions.map(p => p.match?.stage).filter(Boolean))
    return STAGE_FILTER_OPTIONS.filter(o => o.key === 'all' || used.has(o.key))
  }, [predictions])

  if (loading) return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Perfil" />
      <div className="px-4 pt-6 space-y-4 animate-pulse">
        <div className="card flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-elevated flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-brand-elevated" />
            <div className="h-3 w-20 rounded bg-brand-elevated" />
            <div className="h-3 w-24 rounded bg-brand-elevated" />
          </div>
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-brand-elevated" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Perfil" />
      <p className="text-center text-brand-muted mt-10">Usuario no encontrado</p>
    </div>
  )

  const { user, tournamentPrediction } = data
  const initials = user.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const ft = user.favoriteTeam
  const isMe = me?._id === userId

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title={isMe ? 'Mi perfil' : 'Perfil'} />

      <div className="px-4 pt-4 space-y-4">
        {/* User card */}
        <div className="card flex items-center gap-4">
          <div
            className={`w-20 h-20 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0 border-2 border-brand-border ${user.avatar ? 'cursor-zoom-in active:scale-95 transition-transform' : ''}`}
            onClick={() => user.avatar && setAvatarOpen(true)}
          >
            {user.avatar ? (
              <MinioImage src={user.avatar} alt={user.nickname} className="w-full h-full object-cover"
                fallback={<span className="text-2xl font-bold text-brand-primary">{initials}</span>}
              />
            ) : (
              <span className="text-2xl font-bold text-brand-primary">{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight truncate">{user.name}</p>
            <p className="text-brand-muted text-sm">@{user.nickname}</p>
            {ft && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {ft.badgeUrl ? (
                  <MinioImage src={ft.badgeUrl} alt={ft.shortName} className="w-5 h-5 object-contain"
                    fallback={<span className="text-base">{ft.flag}</span>}
                  />
                ) : (
                  <span className="text-base">{ft.flag}</span>
                )}
                <span className="text-sm text-brand-muted">{ft.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {predictions.length > 0 && <StatsCard predictions={predictions} />}

        {/* Tournament predictions */}
        <TournamentSection tp={tournamentPrediction} isMe={isMe} />

        {/* Match predictions */}
        {predictions.length > 0 ? (
          <div>
            <button
              onClick={() => setShowPredictions(v => !v)}
              className="w-full card flex items-center justify-between text-left active:bg-brand-elevated mb-3"
            >
              <div>
                <p className="font-semibold">Historial de pronosticos</p>
                <p className="text-xs text-brand-muted mt-0.5">{predictions.length} partidos finalizados</p>
              </div>
              <span className="text-brand-muted text-lg">{showPredictions ? '▲' : '▼'}</span>
            </button>

            {showPredictions && (
              <>
                {availableStages.length > 2 && (
                  <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                    {availableStages.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setStageFilter(key)}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
                          ${stageFilter === key ? 'bg-brand-primary text-white' : 'bg-brand-elevated text-brand-muted'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {filteredPredictions.length === 0 ? (
                  <p className="text-center text-brand-muted text-sm py-6">Sin pronosticos en esta fase.</p>
                ) : (
                  filteredPredictions.map(pred => (
                    <PredictionCard key={pred._id} pred={pred} />
                  ))
                )}
              </>
            )}
          </div>
        ) : (
          <div className="card text-center py-6">
            <p className="text-brand-muted text-sm">
              {isMe ? 'Todavía no tenés pronosticos en partidos finalizados.' : 'Este usuario no tiene pronosticos visibles aún.'}
            </p>
          </div>
        )}
      </div>

      {/* Avatar lightbox */}
      {avatarOpen && user.avatar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setAvatarOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setAvatarOpen(false)}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div
            className="w-72 h-72 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <MinioImage
              src={user.avatar}
              alt={user.nickname}
              className="w-full h-full object-cover"
              fallback={<span className="w-full h-full flex items-center justify-center text-6xl font-bold text-brand-primary bg-brand-elevated">{initials}</span>}
            />
          </div>
        </div>
      )}
    </div>
  )
}
