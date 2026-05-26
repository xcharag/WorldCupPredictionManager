import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Star, UserPen, X } from 'lucide-react'
import api from '../services/api'

export default function Home() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">
            🌍 Mundial <span className="text-brand-primary">2026</span>
          </h1>
          <p className="text-brand-muted text-sm">Hola, <span className="text-brand-text font-medium">@{user?.nickname}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-brand-muted text-sm active:text-brand-text"
          >
            <UserPen size={15} /> Editar perfil
          </button>
          <button onClick={logout} className="text-brand-muted text-sm active:text-brand-text">
            Salir
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <QuickCard
          icon={<Users size={28} className="text-brand-primary" />}
          title="Mis Grupos"
          desc="Ver y crear grupos de predicción"
          onClick={() => navigate('/groups')}
          color="green"
        />
        <QuickCard
          icon={<Swords size={28} className="text-brand-accent" />}
          title="Partidos"
          desc="Predecir próximos partidos"
          onClick={() => navigate('/matches')}
          color="amber"
        />
        <QuickCard
          icon={<Trophy size={28} className="text-purple-400" />}
          title="Tabla de posiciones"
          desc="Mira cómo te posicionas"
          onClick={() => navigate('/leaderboard')}
          color="purple"
        />
        <QuickCard
          icon={<Star size={28} className="text-blue-400" />}
          title="Torneo"
          desc="Predicciones del torneo"
          onClick={() => navigate('/tournament')}
          color="blue"
        />
      </div>

      {/* Email verification banner */}
      {user && !user.isEmailVerified && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-amber-300">
            📧 Por favor, verifica tu correo electrónico para desbloquear todas las funciones. Revisa tu bandeja de entrada.
          </p>
        </div>
      )}

      {/* Scoring guide */}
      <div className="card">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-brand-accent" /> Guía de puntuación
        </h2>
        <div className="space-y-2 text-sm">
          {[
            ['Resultado correcto (gana o empate)', '+2 pts'],
            ['Marcador exacto', '+1 bono'],
            ['Un marcador correcto', '+1 bono'],
            ['Ambos marcadores correctos', '+2 bono'],
            ['Pronostico perfecto', '= 5 pts'],
          ].map(([label, pts]) => (
            <div key={label} className="flex justify-between text-brand-muted">
              <span>{label}</span>
              <span className="font-semibold text-brand-text">{pts}</span>
            </div>
          ))}
          <div className="border-t border-brand-border pt-2 mt-2">
              <p className="text-xs text-brand-muted font-semibold mb-1">Pronosticos del torneo:</p>
            {[
              ['Campeon', '+50 pts'],
              ['Subcampeon', '+30 pts'],
              ['Maximo goleador / asistidor', '+30 / +20 pts'],
              ['Mas tarjetas amarillas/rojas', '+20 pts'],
            ].map(([label, pts]) => (
              <div key={label} className="flex justify-between text-brand-muted">
                <span>{label}</span>
                <span className="font-semibold text-brand-text">{pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editOpen && <ProfileModal user={user} setUser={setUser} onClose={() => setEditOpen(false)} />}
    </div>
  )
}

function ProfileModal({ user, setUser, onClose }) {
  const isGoogle = !!user?.googleId
  const [name, setName] = useState(user?.name || '')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {}
    if (name !== user.name) payload.name = name
    if (nickname !== user.nickname) payload.nickname = nickname
    if (newPassword) {
      payload.currentPassword = currentPassword
      payload.newPassword = newPassword
    }
    if (!Object.keys(payload).length) { onClose(); return }
    setSaving(true)
    try {
      const { data } = await api.patch('/auth/profile', payload)
      setUser(data.user)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Editar perfil</h2>
          <button onClick={onClose} className="p-1 text-brand-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
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
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              title="Solo letras, números y guiones bajos"
            />
          </div>

          {!isGoogle && (
            <>
              <hr className="border-brand-border" />
              <p className="text-xs text-brand-muted">Cambiar contraseña (dejar vacío para no cambiar)</p>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="input w-full"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="input w-full"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary mt-1">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}

function QuickCard({ icon, title, desc, onClick, color }) {
  const borders = { green: 'border-brand-primary/30', amber: 'border-amber-500/30', purple: 'border-purple-500/30', blue: 'border-blue-500/30' }
  return (
    <button
      onClick={onClick}
      className={`card text-left active:bg-brand-elevated border ${borders[color] || 'border-brand-border'} transition-colors`}
    >
      <div className="mb-2">{icon}</div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-brand-muted mt-0.5">{desc}</p>
    </button>
  )
}
