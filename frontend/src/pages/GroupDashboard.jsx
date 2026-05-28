import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import { GroupDashboardSkeleton } from '../components/Skeletons'
import {
  Swords, Trophy, BarChart3, Users, ChevronRight, ChevronDown, Pencil, Check, X,
  Settings, MessageCircle, Globe, UserCheck,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast, ToastContainer } from '../components/Toast'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-brand-primary' : 'bg-brand-border'
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function GroupDashboard() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toasts, addToast, removeToast } = useToast()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState(null)

  // Rename state
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    description: '',
    whatsappLink: '',
    isPublic: false,
    acceptJoinRequests: false,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)

  const loadGroup = async () => {
    try {
      const { data } = await api.get(`/groups/${groupId}`)
      setGroup(data)
      setSettings({
        description: data.description || '',
        whatsappLink: data.whatsappLink || '',
        isPublic: data.isPublic || false,
        acceptJoinRequests: data.acceptJoinRequests || false,
      })
    } catch {
      navigate('/groups')
    }
  }

  useEffect(() => {
    loadGroup().finally(() => setLoading(false))
  }, [groupId])

  if (loading) return <GroupDashboardSkeleton />
  if (!group) return null

  const isCreator = group.creator?._id === user?._id
  const pendingJoinRequests = group.pendingRequests?.filter(r => r.type === 'request') || []

  function startRename() {
    setNewName(group.name)
    setRenaming(true)
  }

  async function saveRename() {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === group.name) { setRenaming(false); return }
    setRenameSaving(true)
    try {
      const res = await api.patch(`/groups/${groupId}`, { name: trimmed })
      setGroup(g => ({ ...g, name: res.data.name }))
      setRenaming(false)
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al renombrar el grupo', 'error')
    } finally {
      setRenameSaving(false)
    }
  }

  function removeMember(memberId) {
    setConfirmDialog({
      message: 'Seguro que deseas eliminar este miembro del grupo?',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${groupId}/members/${memberId}`)
          const updated = await api.get(`/groups/${groupId}`)
          setGroup(updated.data)
        } catch (err) {
          addToast(err.response?.data?.message || 'Error al eliminar miembro', 'error')
        }
      },
    })
  }

  function deleteGroup() {
    setConfirmDialog({
      message: 'Seguro que deseas eliminar este grupo? Esta accion no se puede deshacer.',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${groupId}`)
          navigate('/groups')
        } catch (err) {
          addToast(err.response?.data?.message || 'Error al eliminar grupo', 'error')
        }
      },
    })
  }

  function leaveGroup() {
    setConfirmDialog({
      message: `¿Seguro que deseas salir del grupo "${group.name}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${groupId}/leave`)
          navigate('/groups')
        } catch (err) {
          addToast(err.response?.data?.message || 'Error al salir del grupo', 'error')
        }
      },
    })
  }

  async function saveSettings() {
    setSettingsSaving(true)
    try {
      const res = await api.patch(`/groups/${groupId}`, settings)
      setGroup(g => ({
        ...g,
        description: res.data.description,
        whatsappLink: res.data.whatsappLink,
        isPublic: res.data.isPublic,
        acceptJoinRequests: res.data.acceptJoinRequests,
      }))
      setSettings(s => ({
        ...s,
        acceptJoinRequests: res.data.acceptJoinRequests,
      }))
      addToast('Configuracion guardada', 'success')
      setShowSettings(false)
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al guardar configuracion', 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  async function approveRequest(userId) {
    try {
      await api.post(`/groups/${groupId}/requests/${userId}/approve`)
      await loadGroup()
      addToast('Solicitud aprobada', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al aprobar solicitud', 'error')
    }
  }

  async function rejectRequest(userId) {
    try {
      await api.delete(`/groups/${groupId}/requests/${userId}`)
      setGroup(g => ({
        ...g,
        pendingRequests: g.pendingRequests.filter(r => r.user._id !== userId),
      }))
      addToast('Solicitud rechazada', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al rechazar solicitud', 'error')
    }
  }

  const actions = [
    {
      icon: <Swords size={24} className="text-brand-accent" />,
      title: 'Pronosticos por partido',
      desc: 'Pronostica resultados de cada partido',
      to: `/groups/${groupId}/matches`,
      color: 'border-amber-500/20',
    },
    {
      icon: <Trophy size={24} className="text-purple-400" />,
      title: 'Pronosticos tops del torneo',
      desc: 'Campeon, goleador y mas',
      to: `/groups/${groupId}/tournament`,
      color: 'border-purple-500/20',
    },
    {
      icon: <BarChart3 size={24} className="text-brand-primary" />,
      title: 'Ranking',
      desc: 'Ver posiciones del grupo',
      to: `/groups/${groupId}/leaderboard`,
      color: 'border-brand-primary/20',
    },
  ]

  return (
    <div className="page max-w-md mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PageHeader
        title={group.name}
        subtitle={`${group.members?.length} miembros`}
        onBack={() => navigate('/groups')}
        action={isCreator && !renaming && (
          <button
            onClick={startRename}
            className="p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-brand-elevated transition-colors"
            aria-label="Renombrar grupo"
          >
            <Pencil size={18} />
          </button>
        )}
      />

      <div className="px-4 pt-4">
        {/* Inline rename form */}
        {renaming && (
          <div className="card mb-4 flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 min-w-0 bg-brand-elevated rounded-xl px-3 py-2 text-sm text-brand-text border border-brand-border focus:outline-none focus:border-brand-primary"
              value={newName}
              maxLength={50}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(false) }}
            />
            <button
              onClick={saveRename}
              disabled={renameSaving || !newName.trim()}
              className="p-2 rounded-xl bg-brand-primary text-white disabled:opacity-40 flex-shrink-0"
              aria-label="Guardar nombre"
            >
              {renameSaving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Check size={16} />}
            </button>
            <button
              onClick={() => setRenaming(false)}
              className="p-2 rounded-xl bg-brand-elevated text-brand-muted flex-shrink-0"
              aria-label="Cancelar"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Description (visible to all) */}
        {group.description && (
          <div className="card mb-4">
            <p className="text-sm text-brand-muted leading-relaxed">{group.description}</p>
          </div>
        )}

        {/* WhatsApp link (visible to all) */}
        {group.whatsappLink && (
          <a
            href={group.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="card mb-4 flex items-center gap-3 text-green-500 font-semibold text-sm"
          >
            <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} />
            </div>
            Unirse al grupo de WhatsApp
            <ChevronRight size={16} className="ml-auto flex-shrink-0" />
          </a>
        )}

        {/* Pending join requests (creator only) */}
        {isCreator && pendingJoinRequests.length > 0 && (
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={16} className="text-brand-primary" />
              <span className="text-sm font-semibold">
                Solicitudes de ingreso ({pendingJoinRequests.length})
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {pendingJoinRequests.map(req => (
                <div key={req.user._id} className="flex items-center gap-3 py-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/users/${req.user._id}`)}
                    className="flex-1 text-sm font-medium text-left hover:text-brand-primary transition-colors"
                  >
                    @{req.user.nickname}
                    {req.user.name && (
                      <span className="text-brand-muted font-normal ml-1.5">{req.user.name}</span>
                    )}
                  </button>
                  <button
                    onClick={() => rejectRequest(req.user._id)}
                    className="p-1.5 rounded-lg text-red-400 bg-brand-elevated"
                    aria-label="Rechazar"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => approveRequest(req.user._id)}
                    className="p-1.5 rounded-lg text-white bg-brand-primary"
                    aria-label="Aprobar"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members card */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-brand-muted" />
            <span className="text-sm text-brand-muted font-medium">Miembros ({group.members?.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.members?.map(m => (
              <div key={m._id} className="bg-brand-elevated text-xs px-2.5 py-1 rounded-full text-brand-text font-medium flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/users/${m._id}`)}
                  className="hover:text-brand-primary transition-colors"
                >
                  @{m.nickname}
                </button>
                {isCreator && m._id !== group.creator?._id && (
                  <button
                    type="button"
                    onClick={() => removeMember(m._id)}
                    className="text-red-400 font-bold leading-none"
                    aria-label={`Eliminar a ${m.nickname}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {isCreator && (
            <button type="button" className="btn-danger mt-3" onClick={deleteGroup}>
              Eliminar grupo
            </button>
          )}
          {!isCreator && (
            <button type="button" className="btn-danger mt-3" onClick={leaveGroup}>
              Salir del grupo
            </button>
          )}
        </div>

        {/* Settings panel (creator only) */}
        {isCreator && (
          <div className="card mb-4">
            <button
              type="button"
              onClick={() => setShowSettings(s => !s)}
              className="flex items-center justify-between w-full"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Settings size={15} className="text-brand-muted" /> Configuracion del grupo
              </span>
              <ChevronDown
                size={16}
                className={`text-brand-muted transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`}
              />
            </button>

            {showSettings && (
              <div className="mt-4 flex flex-col gap-4">
                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-brand-muted mb-1.5">
                    Descripcion (opcional)
                  </label>
                  <textarea
                    className="input text-sm w-full resize-none"
                    rows={3}
                    maxLength={300}
                    placeholder="Describe tu grupo..."
                    value={settings.description}
                    onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                  />
                  <p className="text-xs text-brand-muted mt-1 text-right">
                    {settings.description.length}/300
                  </p>
                </div>

                {/* WhatsApp link */}
                <div>
                  <label className="block text-xs font-medium text-brand-muted mb-1.5">
                    Enlace de grupo de WhatsApp (opcional)
                  </label>
                  <input
                    className="input text-sm"
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={settings.whatsappLink}
                    onChange={e => setSettings(s => ({ ...s, whatsappLink: e.target.value }))}
                  />
                </div>

                {/* isPublic toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Grupo publico</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Visible para todos en "Explorar grupos"
                    </p>
                  </div>
                  <Toggle
                    checked={settings.isPublic}
                    onChange={v =>
                      setSettings(s => ({
                        ...s,
                        isPublic: v,
                        acceptJoinRequests: v ? s.acceptJoinRequests : false,
                      }))
                    }
                  />
                </div>

                {/* acceptJoinRequests toggle (only when public) */}
                {settings.isPublic && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Aceptar solicitudes de ingreso</p>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Permite que usuarios pidan unirse desde "Explorar"
                      </p>
                    </div>
                    <Toggle
                      checked={settings.acceptJoinRequests}
                      onChange={v => setSettings(s => ({ ...s, acceptJoinRequests: v }))}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="btn-primary"
                >
                  {settingsSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation cards */}
        <div className="flex flex-col gap-3">
          {actions.map(({ icon, title, desc, to, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`card flex items-center gap-4 text-left active:bg-brand-elevated border ${color}`}
            >
              <div className="w-12 h-12 bg-brand-elevated rounded-xl flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-brand-muted mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-brand-muted flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-xs p-5">
            <p className="text-sm text-brand-text text-center leading-relaxed mb-5">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl bg-brand-elevated text-brand-text text-sm font-semibold"
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 btn-danger"
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
