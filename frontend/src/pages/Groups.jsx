import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { Plus, Users, ChevronRight, Link as LinkIcon, UserPlus } from 'lucide-react'
import { useToast, ToastContainer } from '../components/Toast'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(null) // groupId
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteNickname, setInviteNickname] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/groups').then(r => setGroups(r.data)).finally(() => setLoading(false))
  }, [])

  const createGroup = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const { data } = await api.post('/groups', { name: newGroupName })
      setGroups(g => [data, ...g])
      setNewGroupName('')
      setShowCreate(false)
      addToast('Grupo creado', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'No se pudo crear el grupo', 'error')
    } finally {
      setCreating(false)
    }
  }

  const copyInviteLink = async (groupId) => {
    try {
      const { data } = await api.get(`/groups/${groupId}/invite-link`)
      await navigator.clipboard.writeText(data.link)
      addToast('Enlace de invitacion copiado', 'success')
    } catch {
      addToast('No se pudo copiar el enlace', 'error')
    }
  }

  const inviteUser = async (e, groupId) => {
    e.preventDefault()
    setInviting(true)
    try {
      await api.post(`/groups/${groupId}/invite-user`, { nickname: inviteNickname })
      addToast(`@${inviteNickname} invitado`, 'success')
      setInviteNickname('')
      setShowInvite(null)
    } catch (err) {
      addToast(err.response?.data?.message || 'No se pudo invitar', 'error')
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center justify-between mb-5">
        <h1 className="section-title">Mis grupos</h1>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-brand-primary-dark">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Create group form */}
      {showCreate && (
        <form onSubmit={createGroup} className="card mb-4 flex flex-col gap-3">
          <h3 className="font-semibold">Crear nuevo grupo</h3>
          <input className="input" type="text" placeholder="Nombre del grupo" maxLength={50}
            value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required autoFocus />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="text-brand-muted mx-auto mb-3" />
          <p className="text-brand-muted">Aun no tienes grupos.</p>
          <p className="text-brand-muted text-sm">Crea uno o unete con un enlace de invitacion.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(group => (
            <div key={group._id} className="card">
              <button
                onClick={() => navigate(`/groups/${group._id}`)}
                className="flex items-center gap-3 w-full text-left"
              >
                <div className="w-11 h-11 bg-brand-elevated rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users size={20} className="text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{group.name}</p>
                  <p className="text-xs text-brand-muted">{group.members?.length || 0} miembros · por @{group.creator?.nickname}</p>
                </div>
                <ChevronRight size={18} className="text-brand-muted flex-shrink-0" />
              </button>

              {/* Quick actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-brand-border">
                <button
                  onClick={() => copyInviteLink(group._id)}
                  className="flex items-center gap-1.5 text-xs text-brand-muted active:text-brand-text px-3 py-1.5 bg-brand-elevated rounded-lg"
                >
                  <LinkIcon size={13} /> Copiar enlace
                </button>
                <button
                  onClick={() => setShowInvite(showInvite === group._id ? null : group._id)}
                  className="flex items-center gap-1.5 text-xs text-brand-muted active:text-brand-text px-3 py-1.5 bg-brand-elevated rounded-lg"
                >
                  <UserPlus size={13} /> Invitar usuario
                </button>
              </div>

              {/* Invite by nickname */}
              {showInvite === group._id && (
                <form onSubmit={e => inviteUser(e, group._id)} className="flex gap-2 mt-2">
                  <input className="input text-sm flex-1" type="text" placeholder="@apodo"
                    value={inviteNickname} onChange={e => setInviteNickname(e.target.value)}
                    autoCapitalize="none" autoCorrect="off" required autoFocus />
                  <button type="submit" className="bg-brand-primary text-white text-sm font-semibold px-4 rounded-xl" disabled={inviting}>
                    {inviting ? '...' : 'Agregar'}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
