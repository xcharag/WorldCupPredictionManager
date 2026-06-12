import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import { TournamentPredictionsSkeleton } from '../components/Skeletons'
import { useToast, ToastContainer } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { Lock, Clock } from 'lucide-react'
import { celebratePredictionSaved } from '../utils/confetti'

const FIELDS = [
  { key: 'champion', label: 'Campeon', icon: '🏆', points: '+50 pts', type: 'team' },
  { key: 'runnerUp', label: 'Subcampeon', icon: '🥈', points: '+30 pts', type: 'team' },
  { key: 'topScorer', label: 'Maximo goleador', icon: '⚽', points: '+30 pts', type: 'player' },
  { key: 'topAssister', label: 'Maximo asistidor', icon: '🎯', points: '+20 pts', type: 'player' },
]

export default function TournamentPredictions({ embedded = false }) {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const backPath = groupId ? `/groups/${groupId}` : '/'

  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [lockAt, setLockAt] = useState(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const [form, setForm] = useState({
    champion: '', runnerUp: '', topScorer: '', topAssister: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/teams'),
      api.get('/players'),
      api.get('/predictions/tournament'),
    ]).then(([teamRes, playerRes, predRes]) => {
      setTeams(teamRes.data)
      setPlayers(playerRes.data)
      setIsLocked(predRes.data.isLocked)
      if (predRes.data.lockAt) setLockAt(new Date(predRes.data.lockAt))
      if (predRes.data.prediction) {
        const p = predRes.data.prediction
        setPrediction(p)
        setForm({
          champion: p.champion?._id || p.champion || '',
          runnerUp: p.runnerUp?._id || p.runnerUp || '',
          topScorer: p.topScorer?._id || p.topScorer || '',
          topAssister: p.topAssister?._id || p.topAssister || '',
        })
      }
    }).finally(() => setLoading(false))
  }, [])

  // Live countdown tick
  useEffect(() => {
    if (!lockAt || isLocked) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockAt, isLocked])

  const countdownStr = (() => {
    if (!lockAt || isLocked) return null
    const ms = lockAt.getTime() - nowMs
    if (ms <= 0) return null
    const totalSecs = Math.floor(ms / 1000)
    const d = Math.floor(totalSecs / 86400)
    const h = Math.floor((totalSecs % 86400) / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    const parts = []
    if (d > 0) parts.push(`${d}d`)
    if (h > 0 || d > 0) parts.push(`${h}h`)
    parts.push(`${String(m).padStart(2, '0')}m`)
    parts.push(`${String(s).padStart(2, '0')}s`)
    return parts.join(' ')
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/predictions/tournament', form)
      setPrediction(res.data)
      celebratePredictionSaved()
      addToast('Pronosticos del torneo guardados', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <TournamentPredictionsSkeleton embedded={embedded} />

  return (
    <div className={embedded ? '' : 'page max-w-md mx-auto'}>
      {!embedded && (
        <PageHeader
          title="Pronosticos tops del torneo"
          subtitle="Se bloquea al finalizar el primer partido"
          onBack={() => navigate(backPath)}
        />
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className={embedded ? 'pt-2' : 'px-4 pt-4'}>
        {countdownStr && (
          <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <Clock size={18} className="text-brand-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-brand-muted leading-none mb-0.5">Se cierra en</p>
              <p className="text-base font-mono font-bold text-brand-primary leading-none">{countdownStr}</p>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Lock size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">Los pronosticos estan bloqueados porque ya hay un partido finalizado.</p>
          </div>
        )}

        {prediction?.points !== null && prediction?.points !== undefined && (
          <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-3 mb-4 text-center">
            <p className="text-xs text-brand-muted">Puntos ganados del torneo</p>
            <p className="text-2xl font-bold text-brand-primary">+{prediction.points} pts</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {FIELDS.map(({ key, label, icon, points, type }) => (
            <div key={key} className="card">
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold flex items-center gap-2">
                  <span>{icon}</span> {label}
                </label>
                <span className="badge-green badge">{points}</span>
              </div>
              <SearchableSelect
                value={form[key]}
                onChange={(nextValue) => setForm(f => ({ ...f, [key]: nextValue }))}
                disabled={isLocked}
                placeholder={`Selecciona ${type === 'team' ? 'seleccion' : 'jugador'}`}
                searchPlaceholder={type === 'team' ? 'Buscar pais...' : 'Buscar jugador...'}
                options={
                  type === 'team'
                    ? teams.map(t => ({ value: t._id, label: `${t.flag} ${t.name}` }))
                    : players.map(p => ({ value: p._id, label: `${p.name} (${p.team?.shortName || '?'})` }))
                }
              />
            </div>
          ))}

          {!isLocked && (
            <button type="submit" className="btn-primary mt-2" disabled={saving}>
              {saving ? 'Guardando...' : prediction ? 'Actualizar pronosticos' : 'Guardar pronosticos'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
