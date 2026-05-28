import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, Camera, Check, LogOut, Moon, Smartphone, Sun, Users, UserPlus, X } from 'lucide-react'
import { isPushSupported, isIOSBrowser, subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from '../utils/push'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { ProfileSkeleton } from '../components/Skeletons'
import { ToastContainer, useToast } from '../components/Toast'
import MinioImage from '../components/MinioImage'

export default function Profile() {
  const { user, setUser, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [teams, setTeams] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const [selectedTeamId, setSelectedTeamId] = useState(user?.favoriteTeam?._id || '')
  const [name, setName] = useState(user?.name || '')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editOpen, setEditOpen] = useState(false)

  const NOTIF_OPTIONS = [
    { key: '24h', label: '24 horas antes' },
    { key: '6h',  label: '6 horas antes' },
    { key: '4h',  label: '4 horas antes' },
    { key: '1h',  label: '1 hora antes' },
  ]
  const [notifPrefs, setNotifPrefs] = useState([])
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifDirty, setNotifDirty] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Push notifications state
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushToggling, setPushToggling] = useState(false)
  const [pushVapidKey, setPushVapidKey] = useState('')
  const [iosOnly, setIosOnly] = useState(false)
  const [pushTimings, setPushTimings] = useState(['1h'])
  const [pushTimingsSaving, setPushTimingsSaving] = useState(false)

  // Privacy settings
  const [acceptGroupInvites, setAcceptGroupInvites] = useState(true)
  const [invitesSaving, setInvitesSaving] = useState(false)

  useEffect(() => {
    api.get('/teams').then((res) => setTeams(res.data || []))
    api.get('/profile/notifications').then((res) => setNotifPrefs(res.data.notificationPreferences || []))
    // Check push support and current subscription status
    if (isPushSupported()) {
      if (isIOSBrowser()) {
        setIosOnly(true)
        setPushSupported(true)
      } else {
        setPushSupported(true)
        Promise.all([
          api.get('/profile/push-status'),
          getCurrentSubscription(),
        ]).then(([statusRes, sub]) => {
          setPushVapidKey(statusRes.data.vapidPublicKey || '')
          setPushEnabled(statusRes.data.enabled && !!sub)
          setPushTimings(statusRes.data.reminderPreferences || ['1h'])
          setAcceptGroupInvites(statusRes.data.acceptGroupInvites !== false)
        }).catch(() => {})
      }
    }
  }, [])

  const handleTogglePush = async () => {
    if (!pushSupported || iosOnly || pushToggling) return
    setPushToggling(true)
    try {
      if (pushEnabled) {
        const endpoint = await unsubscribeFromPush()
        await api.delete('/profile/push-subscribe', { data: { endpoint } })
        setPushEnabled(false)
        addToast('Notificaciones desactivadas')
      } else {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          addToast('Permiso de notificaciones denegado', 'error')
          return
        }
        const sub = await subscribeToPush(pushVapidKey)
        await api.post('/profile/push-subscribe', { subscription: sub })
        setPushEnabled(true)
        addToast('Notificaciones activadas ✓')
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al cambiar notificaciones', 'error')
    } finally {
      setPushToggling(false)
    }
  }

  const togglePushTiming = async (key) => {
    const next = pushTimings.includes(key)
      ? pushTimings.filter(k => k !== key)
      : [...pushTimings, key]
    setPushTimings(next)
    setPushTimingsSaving(true)
    try {
      await api.patch('/profile/push-reminders', { reminderPreferences: next })
    } catch {
      addToast('Error al guardar', 'error')
    } finally {
      setPushTimingsSaving(false)
    }
  }

  const handleToggleGroupInvites = async () => {
    const next = !acceptGroupInvites
    setAcceptGroupInvites(next)
    setInvitesSaving(true)
    try {
      await api.patch('/profile/accept-invites', { acceptGroupInvites: next })
      addToast(next ? 'Invitaciones activadas' : 'Invitaciones desactivadas', 'success')
    } catch {
      setAcceptGroupInvites(!next) // rollback
      addToast('Error al guardar', 'error')
    } finally {
      setInvitesSaving(false)
    }
  }

  const showToast = (message, type = 'success') => addToast(message, type)

  // ── Avatar upload ──────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const { data } = await api.put('/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUser((prev) => ({ ...prev, avatar: data.avatar }))
      showToast('Foto actualizada')
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al subir la foto', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ── Favorite team ──────────────────────────────────────────────
  const handleSaveTeam = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/profile/favorite-team', { teamId: selectedTeamId || null })
      setUser((prev) => ({ ...prev, favoriteTeam: data.favoriteTeam }))
      showToast('Equipo favorito guardado')
    } catch (err) {
      showToast(err.response?.data?.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const toggleNotif = (key) => {
    setNotifPrefs(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) { addToast('Máximo 2 recordatorios permitidos', 'error'); return prev }
      return [...prev, key]
    })
    setNotifDirty(true)
  }

  const handleSaveNotif = async () => {
    setNotifSaving(true)
    try {
      const { data } = await api.put('/profile/notifications', { notificationPreferences: notifPrefs })
      setNotifPrefs(data.notificationPreferences)
      setNotifDirty(false)
      addToast('Preferencias guardadas', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al guardar', 'error')
    } finally {
      setNotifSaving(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setEditError('')
    const payload = {}
    if (name !== user.name) payload.name = name
    if (nickname !== user.nickname) payload.nickname = nickname
    if (newPassword) {
      payload.currentPassword = currentPassword
      payload.newPassword = newPassword
    }
    if (!Object.keys(payload).length) return
    setEditSaving(true)
    try {
      const { data } = await api.patch('/auth/profile', payload)
      setUser(data.user)
      setCurrentPassword('')
      setNewPassword('')
      setEditOpen(false)
      addToast('Perfil actualizado', 'success')
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setEditSaving(false)
    }
  }

  if (!user) return <ProfileSkeleton />

  const teamOptions = [
    { value: '', label: 'Sin selección' },
    ...teams.map((t) => ({
      value: t._id,
      label: `${t.flag || ''} ${t.name}`.trim(),
    })),
  ]

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="page max-w-md mx-auto pb-24">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Mi perfil" onBack={() => navigate(-1)} />

      <div className="px-4 pt-6 space-y-4">

        {/* ── Avatar section ─────────────────────────── */}
        <div className="card flex flex-col items-center gap-4 py-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-brand-elevated border-2 border-brand-primary/40 flex items-center justify-center">
              {user.avatar ? (
                <MinioImage
                  src={user.avatar}
                  alt="avatar"
                  className="w-full h-full object-cover"
                  fallback={<span className="text-3xl font-bold text-brand-primary">{initials}</span>}
                />
              ) : (
                <span className="text-3xl font-bold text-brand-primary">{initials}</span>
              )}
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="text-center">
            <p className="font-bold text-lg">{user.name}</p>
            <p className="text-brand-muted text-sm">@{user.nickname}</p>
            <p className="text-brand-muted text-xs mt-1">{user.email}</p>
          </div>
        </div>

        {/* ── Favorite team ──────────────────────────── */}
        <div className="card space-y-3">
          <p className="font-semibold text-sm">Equipo favorito</p>
          <p className="text-xs text-brand-muted">Aparecerá como badge junto a tu nombre en el ranking.</p>

          {/* Current badge preview */}
          {user.favoriteTeam && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-brand-elevated">
              {user.favoriteTeam.badgeUrl ? (
                <MinioImage src={user.favoriteTeam.badgeUrl} alt={user.favoriteTeam.name} className="w-7 h-7 object-contain"
                  fallback={<span className="text-lg">{user.favoriteTeam.flag}</span>}
                />
              ) : (
                <span className="text-lg">{user.favoriteTeam.flag}</span>
              )}
              <span className="text-sm font-medium">{user.favoriteTeam.name}</span>
              <button
                onClick={() => { setSelectedTeamId('') }}
                className="ml-auto text-brand-muted hover:text-brand-accent transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <SearchableSelect
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={teamOptions}
            placeholder="Selecciona un equipo"
            searchPlaceholder="Buscar equipo..."
          />

          <button
            onClick={handleSaveTeam}
            disabled={saving || selectedTeamId === (user.favoriteTeam?._id || '')}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Guardar equipo
          </button>
        </div>

        {/* ── Editar datos ───────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Datos de cuenta</p>
            <button
              type="button"
              onClick={() => { setEditOpen(o => !o); setEditError('') }}
              className="text-xs font-semibold text-brand-primary"
            >
              {editOpen ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          {editOpen && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 mt-4">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Nombre</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Nickname</label>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="input w-full"
                  required minLength={3} maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  title="Solo letras, números y guiones bajos"
                />
              </div>
              {!user.googleId && (
                <>
                  <hr className="border-brand-border" />
                  <p className="text-xs text-brand-muted">Cambiar contraseña (dejar vacío para no cambiar)</p>
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">Contraseña actual</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                      className="input w-full" autoComplete="current-password" />
                  </div>
                  <div>
                    <label className="text-xs text-brand-muted mb-1 block">Nueva contraseña</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="input w-full" minLength={6} autoComplete="new-password" />
                  </div>
                </>
              )}
              {editError && <p className="text-red-400 text-sm">{editError}</p>}
              <button
                type="submit"
                disabled={editSaving || (name === user.name && nickname === user.nickname && !newPassword)}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {editSaving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={16} />}
                Guardar cambios
              </button>
            </form>
          )}
        </div>

        {/* ── Notificaciones ─────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-brand-primary" />
              <p className="font-semibold text-sm">Recordatorios por email</p>
            </div>
            <button
              type="button"
              onClick={() => { setNotifOpen(o => !o); setNotifDirty(false) }}
              className="text-xs font-semibold text-brand-primary"
            >
              {notifOpen ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          {notifOpen && (
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-xs text-brand-muted">Recibí un email antes de cada partido (máx. 2 opciones).</p>
              <div className="flex flex-col gap-2">
                {NOTIF_OPTIONS.map(({ key, label }) => {
                  const active = notifPrefs.includes(key)
                  const disabled = !active && notifPrefs.length >= 2
                  return (
                    <button
                      key={key}
                      onClick={() => toggleNotif(key)}
                      disabled={disabled}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
                        ${active
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-text'
                          : disabled
                            ? 'border-brand-border bg-transparent text-brand-muted opacity-40'
                            : 'border-brand-border bg-transparent text-brand-muted active:bg-brand-elevated'}`}
                    >
                      <span className="text-sm">{label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${active ? 'border-brand-primary bg-brand-primary' : 'border-brand-border'}`}>
                        {active && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={handleSaveNotif}
                disabled={notifSaving || !notifDirty}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {notifSaving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={16} />}
                Guardar recordatorios
              </button>
            </div>
          )}
        </div>

        {/* ── Notificaciones push ────────────────────── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone size={15} className="text-brand-primary" />
            <p className="font-semibold text-sm">Notificaciones push</p>
          </div>

          {!pushSupported ? (
            <div className="flex items-start gap-3 bg-brand-elevated border border-brand-border rounded-xl px-3 py-3 mt-3">
              <BellOff size={16} className="text-brand-muted flex-shrink-0 mt-0.5" />
              <p className="text-xs text-brand-muted leading-relaxed">
                Las notificaciones push no están disponibles en esta conexión. Accedé a la app desde su URL oficial (HTTPS) para activarlas.
              </p>
            </div>
          ) : iosOnly ? (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3 mt-3">
              <Bell size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                En iPhone/iPad las notificaciones push solo funcionan cuando la app está{' '}
                <strong>instalada en la pantalla de inicio</strong>. Agregala desde el botón «Instalar app» en Inicio y luego activá las notificaciones aquí.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-brand-muted mb-4">
                Activá las notificaciones para recibir recordatorios diarios (11:00 y 17:30) y avisos antes de cada partido sin predecir.
              </p>
              <button
                onClick={handleTogglePush}
                disabled={pushToggling || !pushVapidKey}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors disabled:opacity-50
                  ${pushEnabled
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-text'
                    : 'border-brand-border bg-transparent text-brand-muted active:bg-brand-elevated'}`}
              >
                <div className="flex items-center gap-2">
                  {pushEnabled
                    ? <Bell size={16} className="text-brand-primary" />
                    : <BellOff size={16} className="text-brand-muted" />}
                  <span className="text-sm">
                    {pushEnabled ? 'Notificaciones activadas' : 'Activar notificaciones'}
                  </span>
                </div>
                {pushToggling
                  ? <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  : (
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${
                      pushEnabled ? 'bg-brand-primary' : 'bg-brand-border'
                    }`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        pushEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </div>
                  )}
              </button>

              {/* Timing options — only shown when push is active */}
              {pushEnabled && (
                <div className="mt-4 space-y-3">
                  {/* Daily reminders — always implicit */}
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-brand-elevated border border-brand-border">
                    <Bell size={14} className="text-brand-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-brand-muted leading-relaxed">
                      Recordatorios diarios a las <strong className="text-brand-text">11:00</strong> y{' '}
                      <strong className="text-brand-text">17:30</strong> (UTC) si tenés predicciones pendientes.
                      <span className="ml-1 text-brand-primary font-medium">Siempre activos.</span>
                    </p>
                  </div>

                  {/* Configurable pre-match timings */}
                  <p className="text-xs text-brand-muted flex items-center gap-1.5 pt-1">
                    Recordatorios antes del partido
                    {pushTimingsSaving && <span className="w-3 h-3 border border-brand-muted border-t-transparent rounded-full animate-spin inline-block" />}
                  </p>
                  {NOTIF_OPTIONS.map(({ key, label }) => {
                    const active = pushTimings.includes(key)
                    return (
                      <button
                        key={key}
                        onClick={() => togglePushTiming(key)}
                        disabled={pushTimingsSaving}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors disabled:opacity-60
                          ${active
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-text'
                            : 'border-brand-border bg-transparent text-brand-muted active:bg-brand-elevated'}`}
                      >
                        <span className="text-sm">{label}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${active ? 'border-brand-primary bg-brand-primary' : 'border-brand-border'}`}>
                          {active && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Privacidad / Grupos ────────────────── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} className="text-brand-primary" />
            <p className="font-semibold text-sm">Privacidad de grupos</p>
          </div>
          <p className="text-xs text-brand-muted mb-4">
            Si lo desactivás, otros usuarios no podrán invitarte a sus grupos.
          </p>
          <button
            onClick={handleToggleGroupInvites}
            disabled={invitesSaving}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors disabled:opacity-50
              ${acceptGroupInvites
                ? 'border-brand-primary bg-brand-primary/10 text-brand-text'
                : 'border-brand-border bg-transparent text-brand-muted active:bg-brand-elevated'}`}
          >
            <div className="flex items-center gap-2">
              <UserPlus size={16} className={acceptGroupInvites ? 'text-brand-primary' : 'text-brand-muted'} />
              <span className="text-sm">
                {acceptGroupInvites ? 'Aceptar invitaciones de grupos' : 'Invitaciones de grupos desactivadas'}
              </span>
            </div>
            {invitesSaving
              ? <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              : (
                <div className={`w-11 h-6 rounded-full transition-colors relative ${
                  acceptGroupInvites ? 'bg-brand-primary' : 'bg-brand-border'
                }`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    acceptGroupInvites ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
              )}
          </button>
        </div>

        {/* ── Apariencia ─────────────────────────────── */}
        <div className="card">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between py-3 text-sm"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark'
                ? <Moon size={16} className="text-brand-primary" />
                : <Sun size={16} className="text-brand-primary" />}
              <span>{theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${
              theme === 'dark' ? 'bg-brand-primary' : 'bg-brand-border'
            }`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
          </button>
        </div>

        {/* ── Cerrar sesión ──────────────────────────── */}
        <div className="card">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between py-3 text-sm text-brand-accent hover:opacity-80 transition-opacity"
          >
            <span>Cerrar sesión</span>
            <LogOut size={16} />
          </button>
        </div>

      </div>
    </div>
  )
}
