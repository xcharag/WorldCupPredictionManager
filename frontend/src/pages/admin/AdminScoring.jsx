import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast, ToastContainer } from '../../components/Toast'
import { RefreshCw, Lock, Unlock } from 'lucide-react'

export default function AdminScoring() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [recalcMatchId, setRecalcMatchId] = useState('')
  const [working, setWorking] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    Promise.all([api.get('/admin/settings'), api.get('/admin/matches')])
      .then(([s, m]) => { setSettings(s.data); setMatches(m.data.filter(x => x.status === 'finished')) })
      .finally(() => setLoading(false))
  }, [])

  const toggleLock = async () => {
    setWorking(true)
    try {
      await api.post('/admin/settings/lock-tournament', { locked: !settings.tournamentPredictionsLocked })
      setSettings(s => ({ ...s, tournamentPredictionsLocked: !s.tournamentPredictionsLocked }))
      addToast(`Pronosticos del torneo ${settings.tournamentPredictionsLocked ? 'desbloqueados' : 'bloqueados'}`, 'success')
    } catch { addToast('Error', 'error') }
    finally { setWorking(false) }
  }

  const recalcMatch = async () => {
    if (!recalcMatchId) return
    setWorking(true)
    try {
      const { data } = await api.post('/admin/scoring/recalculate-match', { matchId: recalcMatchId })
      addToast(data.message, 'success')
    } catch (err) { addToast(err.response?.data?.message || 'Error', 'error') }
    finally { setWorking(false) }
  }

  const recalcTournament = async () => {
    setWorking(true)
    try {
      const { data } = await api.post('/admin/scoring/recalculate-tournament')
      addToast(data.message, 'success')
    } catch (err) { addToast(err.response?.data?.message || 'Error', 'error') }
    finally { setWorking(false) }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Puntuacion" onBack={() => navigate('/admin')} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Lock tournament predictions */}
        <div className="card">
          <h3 className="font-bold mb-1">Pronosticos del torneo</h3>
          <p className="text-sm text-brand-muted mb-3">
            Bloquea esto cuando inicie la fase final. Estado actual:{' '}
            <span className={settings?.tournamentPredictionsLocked ? 'text-brand-danger' : 'text-brand-primary'}>
              {settings?.tournamentPredictionsLocked ? 'Bloqueado' : 'Abierto'}
            </span>
          </p>
          <button onClick={toggleLock} disabled={working}
            className={`btn-${settings?.tournamentPredictionsLocked ? 'secondary' : 'danger'} flex items-center justify-center gap-2`}>
            {settings?.tournamentPredictionsLocked ? <Unlock size={16} /> : <Lock size={16} />}
            {settings?.tournamentPredictionsLocked ? 'Desbloquear pronosticos' : 'Bloquear pronosticos'}
          </button>
        </div>

        {/* Recalculate match */}
        <div className="card">
          <h3 className="font-bold mb-3">Recalcular puntos de un partido</h3>
          <SearchableSelect
            value={recalcMatchId}
            onChange={setRecalcMatchId}
            placeholder="Seleccionar partido finalizado"
            searchPlaceholder="Buscar partido..."
            options={[
              { value: '', label: 'Seleccionar partido finalizado' },
              ...matches.map(m => ({
                value: m._id,
                label: `${m.homeTeam?.shortName || 'Por definir'} ${m.homeScore}-${m.awayScore} ${m.awayTeam?.shortName || 'Por definir'}`,
              })),
            ]}
          />
          <button onClick={recalcMatch} disabled={working || !recalcMatchId}
            className="btn-secondary flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Recalcular partido
          </button>
        </div>

        {/* Recalculate tournament */}
        <div className="card">
          <h3 className="font-bold mb-1">Recalcular puntos del torneo</h3>
          <p className="text-sm text-brand-muted mb-3">Ejecuta esto despues de guardar resultados finales.</p>
          <button onClick={recalcTournament} disabled={working}
            className="btn-primary flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Recalcular torneo
          </button>
        </div>
      </div>
    </div>
  )
}
