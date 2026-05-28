import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { GroupListSkeleton } from '../components/Skeletons'
import {
  Plus, Users, ChevronRight, Link as LinkIcon, UserPlus, Share2,
  Globe, Bell, X, Check, MessageCircle,
} from 'lucide-react'
import { useToast, ToastContainer } from '../components/Toast'

export default function Groups() {
  const [activeTab, setActiveTab] = useState('my')
  const [groups, setGroups] = useState([])
  const [publicGroups, setPublicGroups] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPublic, setLoadingPublic] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteNickname, setInviteNickname] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [respondingInvite, setRespondingInvite] = useState(null)
  const [requestingJoin, setRequestingJoin] = useState(null)
  const { toasts, addToast, removeToast } = useToast()
  const navigate = useNavigate()

  const loadMyData = async () => {
    try {
      const [myRes, invRes] = await Promise.all([
        api.get('/groups'),
        api.get('/groups/my-pending'),
      ])
      setGroups(myRes.data)
      setPendingInvites(invRes.data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadMyData().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab !== 'explore') return
    setLoadingPublic(true)
    api.get('/groups/public')
      .then(r => setPublicGroups(r.data))
      .catch(() => addToast('Error al cargar grupos publicos', 'error'))
      .finally(() => setLoadingPublic(false))
  }, [activeTab])

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
      const link = data.link
      let copied = false
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { await navigator.clipboard.writeText(link); copied = true } catch { /* fallthrough */ }
      }
      if (!copied) {
        const ta = document.createElement('textarea')
        ta.value = link
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        copied = document.execCommand('copy')
        document.body.removeChild(ta)
      }
      addToast(copied ? 'Enlace copiado' : 'No se pudo copiar el enlace', copied ? 'success' : 'error')
    } catch {
      addToast('No se pudo copiar el enlace', 'error')
    }
  }

  const shareInviteLink = async (groupId, groupName) => {
    try {
      const { data } = await api.get(`/groups/${groupId}/invite-link`)
      if (navigator.share) {
        await navigator.share({ title: `Unete a ${groupName}`, url: data.link })
      } else {
        await navigator.clipboard.writeText(data.link)
        addToast('Enlace copiado', 'success')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') addToast('No se pudo compartir el enlace', 'error')
    }
  }

  const inviteUser = async (e, groupId) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await api.post(`/groups/${groupId}/invite-user`, { nickname: inviteNickname })
      addToast(res.data.message || `Invitacion enviada a @${inviteNickname}`, 'success')
      setInviteNickname('')
      setShowInvite(null)
    } catch (err) {
      addToast(err.response?.data?.message || 'No se pudo invitar', 'error')
    } finally {
      setInviting(false)
    }
  }

  const respondToInvite = async (groupId, accept) => {
    setRespondingInvite(groupId)
    try {
      await api.post(`/groups/${groupId}/my-invite/respond`, { accept })
      setPendingInvites(inv => inv.filter(i => i._id !== groupId))
      if (accept) {
        await loadMyData()
        addToast('Te uniste al grupo!', 'success')
      } else {
        addToast('Invitacion rechazada', 'success')
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al responder', 'error')
    } finally {
      setRespondingInvite(null)
    }
  }

  const requestJoin = async (groupId) => {
    setRequestingJoin(groupId)
    try {
      await api.post(`/groups/${groupId}/join-request`)
      setPublicGroups(pg => pg.map(g => g._id === groupId ? { ...g, hasRequested: true } : g))
      addToast('Solicitud enviada!', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al enviar solicitud', 'error')
    } finally {
      setRequestingJoin(null)
    }
  }

  const cancelJoinRequest = async (groupId) => {
    setRequestingJoin(groupId)
    try {
      await api.delete(`/groups/${groupId}/join-request`)
      setPublicGroups(pg => pg.map(g => g._id === groupId ? { ...g, hasRequested: false } : g))
      addToast('Solicitud cancelada', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al cancelar solicitud', 'error')
    } finally {
      setRequestingJoin(null)
    }
  }

  if (loading) return <GroupListSkeleton />

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center justify-between mb-5">
        <h1 className="section-title">Grupos</h1>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-brand-primary-dark"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-brand-elevated rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'my' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-muted'
          }`}
        >
          <Users size={15} /> Mis grupos
          {pendingInvites.length > 0 && (
            <span className="bg-brand-primary text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-1">
              {pendingInvites.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'explore' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-muted'
          }`}
        >
          <Globe size={15} /> Explorar
        </button>
      </div>

      {/* Create group form */}
      {showCreate && (
        <form onSubmit={createGroup} className="card mb-4 flex flex-col gap-3">
          <h3 className="font-semibold">Crear nuevo grupo</h3>
          <input
            className="input" type="text" placeholder="Nombre del grupo" maxLength={50}
            value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required autoFocus
          />
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

      {/* ── MY GROUPS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <>
          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Bell size={13} /> Invitaciones pendientes
              </h2>
              <div className="flex flex-col gap-2">
                {pendingInvites.map(invite => (
                  <div key={invite._id} className="card flex items-center gap-3">
                    <div className="w-9 h-9 bg-brand-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users size={16} className="text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{invite.name}</p>
                      <p className="text-xs text-brand-muted">por @{invite.creator?.nickname}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => respondToInvite(invite._id, false)}
                        disabled={respondingInvite === invite._id}
                        className="p-2 rounded-xl bg-brand-elevated text-red-400 disabled:opacity-40"
                        aria-label="Rechazar"
                      >
                        <X size={15} />
                      </button>
                      <button
                        onClick={() => respondToInvite(invite._id, true)}
                        disabled={respondingInvite === invite._id}
                        className="p-2 rounded-xl bg-brand-primary text-white disabled:opacity-40"
                        aria-label="Aceptar"
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="text-brand-muted mx-auto mb-3" />
              <p className="text-brand-muted">Aun no tienes grupos.</p>
              <p className="text-brand-muted text-sm mt-1">Crea uno o unete con un enlace de invitacion.</p>
              <button
                onClick={() => setActiveTab('explore')}
                className="text-brand-primary text-sm font-semibold mt-3"
              >
                Explorar grupos publicos →
              </button>
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
                      <p className="text-xs text-brand-muted">
                        {group.members?.length || 0} miembros · por @{group.creator?.nickname}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-brand-muted flex-shrink-0" />
                  </button>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-brand-border">
                    <button
                      onClick={() => copyInviteLink(group._id)}
                      className="flex items-center gap-1.5 text-xs text-brand-muted active:text-brand-text px-3 py-1.5 bg-brand-elevated rounded-lg"
                    >
                      <LinkIcon size={13} /> Copiar enlace
                    </button>
                    <button
                      onClick={() => shareInviteLink(group._id, group.name)}
                      className="flex items-center gap-1.5 text-xs text-brand-muted active:text-brand-text px-3 py-1.5 bg-brand-elevated rounded-lg"
                    >
                      <Share2 size={13} /> Compartir
                    </button>
                    <button
                      onClick={() => setShowInvite(showInvite === group._id ? null : group._id)}
                      className="flex items-center gap-1.5 text-xs text-brand-muted active:text-brand-text px-3 py-1.5 bg-brand-elevated rounded-lg"
                    >
                      <UserPlus size={13} /> Invitar
                    </button>
                  </div>

                  {/* Invite by nickname */}
                  {showInvite === group._id && (
                    <form onSubmit={e => inviteUser(e, group._id)} className="flex gap-2 mt-2">
                      <input
                        className="input text-sm flex-1" type="text" placeholder="@apodo"
                        value={inviteNickname} onChange={e => setInviteNickname(e.target.value)}
                        autoCapitalize="none" autoCorrect="off" required autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-brand-primary text-white text-sm font-semibold px-4 rounded-xl disabled:opacity-50"
                        disabled={inviting}
                      >
                        {inviting ? '...' : 'Invitar'}
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── EXPLORE TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'explore' && (
        <>
          {loadingPublic ? (
            <GroupListSkeleton />
          ) : publicGroups.length === 0 ? (
            <div className="text-center py-16">
              <Globe size={48} className="text-brand-muted mx-auto mb-3" />
              <p className="text-brand-muted">No hay grupos publicos disponibles.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {publicGroups.map(group => (
                <div key={group._id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-brand-elevated rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Globe size={20} className="text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{group.name}</p>
                      <p className="text-xs text-brand-muted">
                        {group.memberCount} miembros · por @{group.creator?.nickname}
                      </p>
                      {group.description && (
                        <p className="text-xs text-brand-muted mt-1 line-clamp-2 leading-relaxed">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-brand-border flex justify-end">
                    {group.isMember ? (
                      <button
                        onClick={() => navigate(`/groups/${group._id}`)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-brand-primary px-4 py-1.5 bg-brand-elevated rounded-xl"
                      >
                        Ver grupo <ChevronRight size={14} />
                      </button>
                    ) : group.hasRequested ? (
                      <button
                        onClick={() => cancelJoinRequest(group._id)}
                        disabled={requestingJoin === group._id}
                        className="flex items-center gap-1.5 text-xs text-brand-muted px-4 py-1.5 bg-brand-elevated rounded-xl disabled:opacity-50"
                      >
                        {requestingJoin === group._id ? '...' : 'Solicitud enviada · Cancelar'}
                      </button>
                    ) : group.acceptJoinRequests ? (
                      <button
                        onClick={() => requestJoin(group._id)}
                        disabled={requestingJoin === group._id}
                        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-primary px-4 py-1.5 rounded-xl disabled:opacity-50"
                      >
                        <UserPlus size={14} />
                        {requestingJoin === group._id ? 'Enviando...' : 'Solicitar unirse'}
                      </button>
                    ) : (
                      <span className="text-xs text-brand-muted px-2 py-1.5">
                        No acepta solicitudes
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
