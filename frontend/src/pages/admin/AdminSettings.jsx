import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import { useToast, ToastContainer } from '../../components/Toast'
import { Lock, Unlock } from 'lucide-react'

export default function AdminSettings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    api.get('/admin/settings').then(r => setSettings(r.data)).finally(() => setLoading(false))
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

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Configuracion" onBack={() => navigate('/admin')} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="px-4 pt-4">
        <div className="card">
          <h3 className="font-bold mb-1">Bloqueo de pronosticos del torneo</h3>
          <p className="text-sm text-brand-muted mb-4">
            Estado: <span className={settings?.tournamentPredictionsLocked ? 'text-brand-danger font-semibold' : 'text-brand-primary font-semibold'}>
              {settings?.tournamentPredictionsLocked ? 'Bloqueado' : 'Abierto'}
            </span>
          </p>
          <button onClick={toggleLock} disabled={working}
            className={`${settings?.tournamentPredictionsLocked ? 'btn-secondary' : 'btn-danger'} flex items-center justify-center gap-2`}>
            {settings?.tournamentPredictionsLocked ? <Unlock size={16} /> : <Lock size={16} />}
            {settings?.tournamentPredictionsLocked ? 'Desbloquear pronosticos' : 'Bloquear pronosticos'}
          </button>
        </div>
      </div>
    </div>
  )
}
