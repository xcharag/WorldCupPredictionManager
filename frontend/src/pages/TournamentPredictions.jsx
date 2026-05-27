import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import { TournamentPredictionsSkeleton } from '../components/Skeletons'
import { useToast, ToastContainer } from '../components/Toast'
import SearchableSelect from '../components/SearchableSelect'
import { Lock } from 'lucide-react'
import { celebratePredictionSaved } from '../utils/confetti'

const FIELDS = [
  { key: 'champion', label: 'Campeon', icon: '🏆', points: '+50 pts', type: 'team' },
  { key: 'runnerUp', label: 'Subcampeon', icon: '🥈', points: '+30 pts', type: 'team' },
  { key: 'topScorer', label: 'Maximo goleador', icon: '⚽', points: '+30 pts', type: 'player' },
  { key: 'topAssister', label: 'Maximo asistidor', icon: '🎯', points: '+20 pts', type: 'player' },
  { key: 'mostYellowCards', label: 'Mas tarjetas amarillas', icon: '🟨', points: '+20 pts', type: 'player' },
  { key: 'mostRedCards', label: 'Mas tarjetas rojas', icon: '🟥', points: '+20 pts', type: 'player' },
]

export default function TournamentPredictions() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const backPath = groupId ? `/groups/${groupId}` : '/'

  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [form, setForm] = useState({
    champion: '', runnerUp: '', topScorer: '', topAssister: '',
    mostYellowCards: '', mostRedCards: '',
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
      if (predRes.data.prediction) {
        const p = predRes.data.prediction
        setPrediction(p)
        setForm({
          champion: p.champion?._id || p.champion || '',
          runnerUp: p.runnerUp?._id || p.runnerUp || '',
          topScorer: p.topScorer?._id || p.topScorer || '',
          topAssister: p.topAssister?._id || p.topAssister || '',
          mostYellowCards: p.mostYellowCards?._id || p.mostYellowCards || '',
          mostRedCards: p.mostRedCards?._id || p.mostRedCards || '',
        })
      }
    }).finally(() => setLoading(false))
  }, [])

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

  if (loading) return <TournamentPredictionsSkeleton />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader
        title="Pronosticos del torneo"
        subtitle="Se bloquea en dieciseisavos"
        onBack={() => navigate(backPath)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-4">
        {isLocked && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Lock size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">Los pronosticos estan bloqueados porque ya inicio la fase final.</p>
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
