import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import { useToast, ToastContainer } from '../components/Toast'
import { Lock } from 'lucide-react'
import { celebratePredictionSaved } from '../utils/confetti'

export default function PredictionForm() {
  const { groupId, matchId } = useParams()
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const backPath = groupId ? `/groups/${groupId}/matches` : '/matches'

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

  if (loading) return <LoadingSpinner fullScreen />
  if (!match) return null

  const isLocked =
    match.status !== 'scheduled' ||
    (match.matchDate && new Date(match.matchDate).getTime() <= Date.now())

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader
        title="Tu pronostico"
        subtitle={`${match.homeTeam?.shortName || 'Por definir'} vs ${match.awayTeam?.shortName || 'Por definir'}`}
        onBack={() => navigate(backPath)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-6">
        {/* Match info */}
        <div className="card mb-6 text-center">
          <p className="text-xs text-brand-muted mb-2">
            {match.matchDate ? new Date(match.matchDate).toLocaleString('es-ES', {
              weekday: 'long', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            }) : '—'}
          </p>
          {match.venue && <p className="text-xs text-brand-muted">{match.venue}</p>}
        </div>

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
            <div className="flex items-center justify-center gap-4 mb-8">
              {/* Home team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-3xl">{match.homeTeam?.flag || '🏳️'}</span>
                <span className="font-bold">{match.homeTeam?.shortName || 'Por definir'}</span>
                <ScorePicker
                  value={homeScore}
                  onChange={setHomeScore}
                  onAdjust={(d) => adjustScore(setHomeScore, homeScore, d)}
                />
              </div>

              <div className="text-brand-muted font-bold text-lg mb-6">–</div>

              {/* Away team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-3xl">{match.awayTeam?.flag || '🏳️'}</span>
                <span className="font-bold">{match.awayTeam?.shortName || 'Por definir'}</span>
                <ScorePicker
                  value={awayScore}
                  onChange={setAwayScore}
                  onAdjust={(d) => adjustScore(setAwayScore, awayScore, d)}
                />
              </div>
            </div>

            {/* Outcome preview */}
            {homeScore !== '' && awayScore !== '' && (
              <div className="card mb-4 text-center">
                <p className="text-xs text-brand-muted mb-1">Resultado esperado</p>
                <p className="font-semibold">
                  {Number(homeScore) > Number(awayScore)
                    ? `Gana ${match.homeTeam?.shortName || 'local'}`
                    : Number(awayScore) > Number(homeScore)
                    ? `Gana ${match.awayTeam?.shortName || 'visitante'}`
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
