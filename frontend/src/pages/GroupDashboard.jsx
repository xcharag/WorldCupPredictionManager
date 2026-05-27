import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import { GroupDashboardSkeleton } from '../components/Skeletons'
import { Swords, Trophy, BarChart3, Users, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function GroupDashboard() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState(null)

  useEffect(() => {
    api.get(`/groups/${groupId}`)
      .then(r => setGroup(r.data))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false))
  }, [groupId])

  if (loading) return <GroupDashboardSkeleton />
  if (!group) return null
  const isCreator = group.creator?._id === user?._id

  function removeMember(memberId) {
    setConfirmDialog({
      message: 'Seguro que deseas eliminar este miembro del grupo?',
      onConfirm: async () => {
        await api.delete(`/groups/${groupId}/members/${memberId}`)
        const updated = await api.get(`/groups/${groupId}`)
        setGroup(updated.data)
      },
    })
  }

  function deleteGroup() {
    setConfirmDialog({
      message: 'Seguro que deseas eliminar este grupo? Esta accion no se puede deshacer.',
      onConfirm: async () => {
        await api.delete(`/groups/${groupId}`)
        navigate('/groups')
      },
    })
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
      <PageHeader
        title={group.name}
        subtitle={`${group.members?.length} miembros`}
        onBack={() => navigate('/groups')}
      />

      <div className="px-4 pt-4">
        {/* Members preview */}
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
        </div>

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
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
