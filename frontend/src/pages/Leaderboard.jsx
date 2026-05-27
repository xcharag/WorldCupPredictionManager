import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import { LeaderboardSkeleton } from '../components/Skeletons'
import { useAuth } from '../contexts/AuthContext'
import SearchableSelect from '../components/SearchableSelect'
import MinioImage from '../components/MinioImage'

function RankBadge({ rank }) {
  if (rank === 1) return <div className="rank-badge bg-yellow-500/20 text-yellow-400">🥇</div>
  if (rank === 2) return <div className="rank-badge bg-gray-400/20 text-gray-300">🥈</div>
  if (rank === 3) return <div className="rank-badge bg-amber-600/20 text-amber-500">🥉</div>
  return <div className="rank-badge bg-brand-elevated text-brand-muted text-xs">{rank}</div>
}

export default function Leaderboard() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [groups, setGroups] = useState([])
  const [group, setGroup] = useState(null)
  const [scope, setScope] = useState(groupId || 'global')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupId) setScope(groupId)
  }, [groupId])

  useEffect(() => {
    api.get('/groups').then((res) => setGroups(res.data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    if (scope !== 'global') {
      Promise.all([
        api.get(`/leaderboard/${scope}`),
        api.get(`/groups/${scope}`),
      ]).then(([lb, grp]) => {
        setEntries(lb.data)
        setGroup(grp.data)
      }).finally(() => setLoading(false))
      return
    }

    api.get('/leaderboard/global')
      .then((lb) => {
        setEntries(lb.data)
        setGroup(null)
      })
      .finally(() => setLoading(false))
  }, [scope])

  if (loading) return <LeaderboardSkeleton />

  const myEntry = entries.find(e => e.user._id === user?._id)

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader
        title="Ranking"
        subtitle={scope === 'global' ? 'Ranking global' : group?.name}
        onBack={() => navigate(scope === 'global' ? '/' : `/groups/${scope}`)}
      />

      <div className="px-4 pt-4">
        <div className="card mb-4">
          <p className="text-xs text-brand-muted mb-2">Ver ranking de:</p>
          <SearchableSelect
            value={scope}
            onChange={setScope}
            options={[
              { value: 'global', label: 'Global' },
              ...groups.map((g) => ({ value: g._id, label: g.name })),
            ]}
            placeholder="Selecciona ranking"
            searchPlaceholder="Buscar grupo..."
          />
        </div>

        {/* My position summary */}
        {myEntry && (
          <div className="card mb-4 bg-brand-primary/10 border border-brand-primary/30">
            <p className="text-xs text-brand-muted mb-1">Tu posicion</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RankBadge rank={myEntry.rank} />
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0">
                  {user?.avatar ? (
                    <MinioImage src={user.avatar} alt="me" className="w-full h-full object-cover"
                      fallback={<span className="text-sm font-bold text-brand-primary">{user?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}</span>}
                    />
                  ) : (
                    <span className="text-sm font-bold text-brand-primary">
                      {user?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold">@{myEntry.user.nickname}</p>
                    {myEntry.user.favoriteTeam && (
                      myEntry.user.favoriteTeam.badgeUrl ? (
                        <MinioImage src={myEntry.user.favoriteTeam.badgeUrl} alt="" className="w-4 h-4 object-contain" fallback={<span className="text-sm">{myEntry.user.favoriteTeam.flag}</span>} />
                      ) : (
                        <span className="text-sm">{myEntry.user.favoriteTeam.flag}</span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-brand-muted">{myEntry.matchPoints} partido + {myEntry.tournamentPoints} torneo</p>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-brand-primary">{myEntry.totalPoints}</p>
            </div>
          </div>
        )}

        {/* Full table */}
        <div className="card">
          {/* Header */}
          <div className="flex items-center text-xs text-brand-muted font-semibold pb-2 border-b border-brand-border mb-1">
            <span className="w-10 text-center">#</span>
            <span className="flex-1 pl-2">Jugador</span>
            <span className="w-12 text-center">Part.</span>
            <span className="w-14 text-center">Torneo</span>
            <span className="w-14 text-right">Total</span>
          </div>

          {entries.map((entry) => {
            const isMe = entry.user._id === user?._id
            const ft = entry.user.favoriteTeam
            const initials = entry.user.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            return (
              <button
                key={entry.user._id}
                onClick={() => navigate(`/users/${entry.user._id}`)}
                className={`flex items-center py-2.5 border-b border-brand-border last:border-0 w-full text-left active:bg-brand-elevated transition-colors ${isMe ? 'bg-brand-primary/5 -mx-4 px-4 rounded-xl' : ''}`}
              >
                <div className="w-10 flex justify-center">
                  <RankBadge rank={entry.rank} />
                </div>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0 mr-2">
                  {entry.user.avatar ? (
                    <MinioImage src={entry.user.avatar} alt={entry.user.nickname} className="w-full h-full object-cover"
                      fallback={<span className="text-xs font-bold text-brand-primary">{initials}</span>}
                    />
                  ) : (
                    <span className="text-xs font-bold text-brand-primary">{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-semibold text-sm truncate ${isMe ? 'text-brand-primary' : ''}`}>
                      @{entry.user.nickname}
                    </p>
                    {ft && (
                      ft.badgeUrl ? (
                        <MinioImage src={ft.badgeUrl} alt={ft.shortName} title={ft.name} className="w-4 h-4 object-contain flex-shrink-0" fallback={<span className="text-sm leading-none">{ft.flag}</span>} />
                      ) : (
                        <span className="text-sm leading-none flex-shrink-0" title={ft.name}>{ft.flag}</span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-brand-muted truncate">{entry.user.name}</p>
                </div>
                <span className="w-12 text-center text-sm text-brand-muted">{entry.matchPoints}</span>
                <span className="w-14 text-center text-sm text-brand-muted">{entry.tournamentPoints}</span>
                <span className="w-14 text-right font-bold text-brand-text">{entry.totalPoints}</span>
              </button>
            )
          })}

          {entries.length === 0 && (
            <p className="text-brand-muted text-sm text-center py-6">Sin puntajes aun</p>
          )}
        </div>
      </div>
    </div>
  )
}
