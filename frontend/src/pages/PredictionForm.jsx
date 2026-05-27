import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useToast, ToastContainer } from '../components/Toast'
import { Lock, ArrowLeft } from 'lucide-react'
import { celebratePredictionSaved } from '../utils/confetti'
import MinioImage from '../components/MinioImage'

const STAGE_LABELS = {
  group_stage:  'Fase de grupos',
  round_of_32:  'Ronda de 32',
  round_of_16:  'Octavos de final',
  quarter_final: 'Cuartos de final',
  semi_final:   'Semifinales',
  third_place:  'Tercer puesto',
  final:        'Final',
}

export default function PredictionForm() {
  const { groupId, matchId } = useParams()
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const backPath = groupId ? `/groups/${groupId}/matches` : '/matches'
  const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate(backPath))

  const [match, setMatch] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/matches/${matchId}`),
      api.get(`/predictions/match/${matchId}`),
    ]).then(([matchRes, predRes]) => {
      setMatch(matchRes.data)
      if (predRes.data) {
        setPrediction(predRes.data)
        setHomeScore(String(predRes.data.predictedHomeScore))
        setAwayScore(String(predRes.data.predictedAwayScore))
      }
    }).finally(() => setLoading(false))
  }, [matchId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/predictions/match', {
        matchId,
        predictedHomeScore: Number(homeScore),
        predictedAwayScore: Number(awayScore),
      })
      setPrediction(res.data)
      celebratePredictionSaved()
      addToast('Pronostico guardado', 'success')
      setTimeout(() => navigate(backPath), 1200)
    } catch (err) {
      const apiMessage = err.response?.data?.message
      if (apiMessage?.toLowerCase().includes('locked') || apiMessage?.toLowerCase().includes('starts')) {
        addToast('No podes modificar una prediccion de un partido pasado o finalizado.', 'error')
      } else {
        addToast(apiMessage || 'No se pudo guardar', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const adjustScore = (setter, val, delta) => {
    const n = Math.max(0, Math.min(99, (parseInt(val) || 0) + delta))
    setter(String(n))
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-bg pb-24 animate-pulse">
      {/* Banner skeleton */}
      <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-[#0a1535] to-brand-navy" />
        {/* stage pill placeholder */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="h-5 w-28 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4 max-w-md mx-auto">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-20 h-20 rounded-2xl bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
          <div className="px-2">
            <div className="h-3 w-5 rounded bg-white/10" />
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-20 h-20 rounded-2xl bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        </div>
        <div className="relative z-10 pb-5 text-center max-w-md mx-auto space-y-1.5">
          <div className="h-2.5 w-40 rounded bg-white/10 mx-auto" />
          <div className="h-2 w-28 rounded bg-white/10 mx-auto" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-brand-bg to-transparent" />
      </div>
      {/* Score-picker skeleton */}
      <div className="px-4 pt-6 max-w-md mx-auto">
        <div className="flex items-center justify-center gap-8 mb-8">
          {[0, 1].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand-elevated" />
              <div className="w-16 h-14 rounded-xl bg-brand-elevated" />
              <div className="w-10 h-10 rounded-xl bg-brand-elevated" />
              <div className="h-2.5 w-12 rounded bg-brand-elevated mt-1" />
            </div>
          ))}
        </div>
        <div className="h-12 rounded-xl bg-brand-elevated" />
      </div>
    </div>
  )
  if (!match) return null

  const isLocked =
    match.status !== 'scheduled' ||
    (match.matchDate && new Date(match.matchDate).getTime() <= Date.now())

  const dateStr = match.matchDate
    ? new Date(match.matchDate).toLocaleString('es-ES', {
        weekday: 'long', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam

  return (
    <div className="min-h-screen bg-brand-bg pb-24">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Match Banner ──────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
        {/* TheSportsDB thumb — blurred, covers full banner */}
        {match.thumbUrl && (
          <MinioImage
            src={match.thumbUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
            style={{ filter: 'blur(6px) brightness(0.45)' }}
          />
        )}
        {/* Gradient background (fallback when no thumb, or always as overlay for readability) */}
        <div className={`absolute inset-0 bg-gradient-to-r from-brand-navy via-[#0a1535] to-brand-navy ${match.thumbUrl ? 'opacity-60' : 'opacity-100'}`} />
        {/* Radial glows behind each badge */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 bg-gradient-to-r from-brand-primary/20 to-transparent" />
          <div className="flex-1 bg-gradient-to-l from-brand-accent/20 to-transparent" />
        </div>
        {/* Subtle pitch lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, white 39px, white 40px)',
          }}
        />

        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Stage / round pill */}
        {match.stage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/10 backdrop-blur-sm text-white/80">
              {STAGE_LABELS[match.stage] || match.stage}
            </span>
          </div>
        )}

        {/* Teams row */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4 max-w-md mx-auto">

          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-xl overflow-hidden">
              {homeTeam?.badgeUrl ? (
                <MinioImage
                  src={homeTeam.badgeUrl}
                  alt={homeTeam.name}
                  className="w-16 h-16 object-contain drop-shadow-lg"
                  fallback={<span className="text-5xl">{homeTeam?.flag || '🏳️'}</span>}
                />
              ) : (
                <span className="text-5xl">{homeTeam?.flag || '🏳️'}</span>
              )}
            </div>
            <p className="text-white font-bold text-sm text-center leading-tight drop-shadow">
              {homeTeam?.shortName || 'Por definir'}
            </p>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1 px-2">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">VS</span>
            {prediction && (
              <span className="text-white font-black text-2xl tracking-tight">
                {prediction.predictedHomeScore}–{prediction.predictedAwayScore}
              </span>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-xl overflow-hidden">
              {awayTeam?.badgeUrl ? (
                <MinioImage
                  src={awayTeam.badgeUrl}
                  alt={awayTeam.name}
                  className="w-16 h-16 object-contain drop-shadow-lg"
                  fallback={<span className="text-5xl">{awayTeam?.flag || '🏳️'}</span>}
                />
              ) : (
                <span className="text-5xl">{awayTeam?.flag || '🏳️'}</span>
              )}
            </div>
            <p className="text-white font-bold text-sm text-center leading-tight drop-shadow">
              {awayTeam?.shortName || 'Por definir'}
            </p>
          </div>
        </div>

        {/* Date & venue */}
        <div className="relative z-10 pb-5 text-center max-w-md mx-auto">
          {dateStr && <p className="text-white/70 text-xs capitalize">{dateStr}</p>}
          {match.venue && <p className="text-white/50 text-[11px] mt-0.5">{match.venue}</p>}
        </div>

        {/* Bottom fade into page bg */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-brand-bg to-transparent" />
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 max-w-md mx-auto">
        {isLocked ? (
          <div className="card text-center">
            <Lock size={40} className="text-brand-muted mx-auto mb-3" />
            <p className="font-semibold">Pronosticos bloqueados</p>
            <p className="text-sm text-brand-muted mt-1">No podes modificar una prediccion de un partido pasado o finalizado.</p>
            {prediction && (
              <div className="mt-4 bg-brand-elevated rounded-xl p-3">
                <p className="text-xs text-brand-muted mb-1">Tu pronostico</p>
                <p className="text-3xl font-bold text-brand-accent">
                  {prediction.predictedHomeScore} – {prediction.predictedAwayScore}
                </p>
                {prediction.points !== null && (
                  <p className="text-brand-primary font-semibold mt-1">+{prediction.points} puntos</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Score picker */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* Home team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <ScorePicker
                  value={homeScore}
                  onChange={setHomeScore}
                  onAdjust={(d) => adjustScore(setHomeScore, homeScore, d)}
                />
                <span className="text-xs text-brand-muted font-medium">{homeTeam?.shortName || 'Local'}</span>
              </div>

              <div className="text-brand-muted font-bold text-2xl pb-5">–</div>

              {/* Away team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <ScorePicker
                  value={awayScore}
                  onChange={setAwayScore}
                  onAdjust={(d) => adjustScore(setAwayScore, awayScore, d)}
                />
                <span className="text-xs text-brand-muted font-medium">{awayTeam?.shortName || 'Visitante'}</span>
              </div>
            </div>

            {/* Outcome preview */}
            {homeScore !== '' && awayScore !== '' && (
              <div className="card mb-4 text-center">
                <p className="text-xs text-brand-muted mb-1">Resultado esperado</p>
                <p className="font-semibold">
                  {Number(homeScore) > Number(awayScore)
                    ? `Gana ${homeTeam?.shortName || 'local'}`
                    : Number(awayScore) > Number(homeScore)
                    ? `Gana ${awayTeam?.shortName || 'visitante'}`
                    : 'Empate'}
                </p>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={saving || homeScore === '' || awayScore === ''}>
              {saving ? 'Guardando...' : prediction ? 'Actualizar pronostico' : 'Guardar pronostico'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ScorePicker({ value, onChange, onAdjust }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => onAdjust(1)}
        className="w-10 h-10 bg-brand-elevated rounded-xl text-xl font-bold text-brand-primary active:bg-brand-border">
        +
      </button>
      <input
        type="number"
        className="score-input"
        min={0} max={99}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
      />
      <button type="button" onClick={() => onAdjust(-1)}
        className="w-10 h-10 bg-brand-elevated rounded-xl text-xl font-bold text-brand-muted active:bg-brand-border">
        −
      </button>
    </div>
  )
}
