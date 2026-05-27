import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, LogOut, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { ProfileSkeleton } from '../components/Skeletons'
import { ToastContainer, useToast } from '../components/Toast'
import MinioImage from '../components/MinioImage'

export default function Profile() {
  const { user, setUser, logout } = useAuth()
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

  useEffect(() => {
    api.get('/teams').then((res) => setTeams(res.data || []))
  }, [])

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
