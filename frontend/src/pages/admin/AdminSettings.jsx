import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import { useToast, ToastContainer } from '../../components/Toast'
import { Lock, Unlock, Timer } from 'lucide-react'

function useCountdown(expiryIso) {
  const [remaining, setRemaining] = useState(() => expiryIso ? Math.max(0, new Date(expiryIso) - Date.now()) : 0)
  useEffect(() => {
    if (!expiryIso) { setRemaining(0); return }
    const tick = () => setRemaining(Math.max(0, new Date(expiryIso) - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiryIso])
  if (!remaining) return null
  const h = Math.floor(remaining / 3600000)
  const m = Math.floor((remaining % 3600000) / 60000)
  const s = Math.floor((remaining % 60000) / 1000)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export default function AdminSettings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [unlockHours, setUnlockHours] = useState(24)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    api.get('/admin/settings').then(r => setSettings(r.data)).finally(() => setLoading(false))
  }, [])

  const countdown = useCountdown(settings?.tournamentUnlockExpiry)

  const toggleLock = async () => {
    setWorking(true)
    try {
      await api.post('/admin/settings/lock-tournament', { locked: !settings.tournamentPredictionsLocked })
      setSettings(s => ({ ...s, tournamentPredictionsLocked: !s.tournamentPredictionsLocked }))
      addToast(`Pronosticos del torneo ${settings.tournamentPredictionsLocked ? 'desbloqueados' : 'bloqueados'}`, 'success')
    } catch { addToast('Error', 'error') }
    finally { setWorking(false) }
  }

  const openUnlockWindow = async () => {
    if (!confirm(`¿Abrir una ventana de ${unlockHours}h para que los usuarios modifiquen sus predicciones del torneo?`)) return
    setWorking(true)
    try {
      const { data } = await api.post('/admin/settings/unlock-tournament', { hours: unlockHours })
      setSettings(s => ({ ...s, tournamentUnlockExpiry: data.expiresAt }))
      addToast(`Ventana abierta por ${unlockHours}h`, 'success')
    } catch { addToast('Error al abrir ventana', 'error') }
    finally { setWorking(false) }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Configuracion" onBack={() => navigate('/admin')} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* Lock / unlock toggle */}
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

        {/* Timed unlock window */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Timer size={18} className="text-amber-400" />
            <h3 className="font-bold">Ventana de última oportunidad</h3>
          </div>
          <p className="text-sm text-brand-muted mb-3">
            Abre un período temporal para que los usuarios puedan cambiar o completar sus predicciones del torneo
            (campeón, subcampeón, goleador, etc.) aunque las predicciones estén bloqueadas.
          </p>

          {countdown ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-center">
              <p className="text-xs text-brand-muted mb-0.5">Ventana activa — cierra en</p>
              <p className="text-xl font-bold text-amber-400 font-mono">{countdown}</p>
            </div>
          ) : (
            <p className="text-xs text-brand-muted mb-3">No hay ventana activa.</p>
          )}

          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-brand-muted flex-shrink-0">Duración:</label>
            <select
              value={unlockHours}
              onChange={e => setUnlockHours(Number(e.target.value))}
              className="input text-sm flex-1"
            >
              {[6, 12, 24, 48, 72].map(h => (
                <option key={h} value={h}>{h} horas</option>
              ))}
            </select>
          </div>

          <button
            onClick={openUnlockWindow}
            disabled={working}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Unlock size={16} />
            {countdown ? `Extender ventana (${unlockHours}h más)` : `Abrir ventana de ${unlockHours}h`}
          </button>
        </div>

      </div>
    </div>
  )
}
