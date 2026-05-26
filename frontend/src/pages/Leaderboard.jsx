import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import SearchableSelect from '../components/SearchableSelect'

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

  if (loading) return <LoadingSpinner fullScreen />

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
                <div>
                  <p className="font-bold">@{myEntry.user.nickname}</p>
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
            return (
              <div
                key={entry.user._id}
                className={`flex items-center py-3 border-b border-brand-border last:border-0 ${isMe ? 'bg-brand-primary/5 -mx-4 px-4 rounded-xl' : ''}`}
              >
                <div className="w-10 flex justify-center">
                  <RankBadge rank={entry.rank} />
                </div>
                <div className="flex-1 pl-2 min-w-0">
                  <p className={`font-semibold text-sm truncate ${isMe ? 'text-brand-primary' : ''}`}>
                    @{entry.user.nickname}
                  </p>
                  <p className="text-xs text-brand-muted truncate">{entry.user.name}</p>
                </div>
                <span className="w-12 text-center text-sm text-brand-muted">{entry.matchPoints}</span>
                <span className="w-14 text-center text-sm text-brand-muted">{entry.tournamentPoints}</span>
                <span className="w-14 text-right font-bold text-brand-text">{entry.totalPoints}</span>
              </div>
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
