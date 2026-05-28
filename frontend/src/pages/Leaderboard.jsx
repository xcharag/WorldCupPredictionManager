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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    if (groupId) setScope(groupId)
  }, [groupId])

  // Reset to first page whenever the scope or page size changes
  useEffect(() => {
    setPage(1)
  }, [scope, pageSize])

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
  const totalPages = Math.ceil(entries.length / pageSize)
  const paginatedEntries = entries.slice((page - 1) * pageSize, page * pageSize)

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
        <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center text-xs text-brand-muted font-semibold px-4 py-2 border-b border-brand-border">
            <span className="w-10 text-center">#</span>
            <span className="flex-1 pl-2">Jugador</span>
            <span className="w-8 text-center">P.</span>
            <span className="w-8 text-center">T.</span>
            <span className="w-12 text-right">Total</span>
          </div>

          {paginatedEntries.map((entry) => {
            const isMe = entry.user._id === user?._id
            const ft = entry.user.favoriteTeam
            const initials = entry.user.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            return (
              <button
                key={entry.user._id}
                onClick={() => navigate(`/users/${entry.user._id}`)}
                className={`flex items-center py-2.5 px-4 border-b border-brand-border last:border-0 w-full text-left transition-colors ${isMe ? 'bg-brand-primary/5' : 'active:bg-brand-elevated'}`}
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
                <span className="w-8 text-center text-sm text-brand-muted">{entry.matchPoints}</span>
                <span className="w-8 text-center text-sm text-brand-muted">{entry.tournamentPoints}</span>
                <span className="w-12 text-right font-bold text-brand-text">{entry.totalPoints}</span>
              </button>
            )
          })}

          {entries.length === 0 && (
            <p className="text-brand-muted text-sm text-center px-4 py-6">Sin puntajes aun</p>
          )}
        </div>

        {/* Pagination controls */}
        {entries.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {/* Page size selector */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-brand-muted">
                {entries.length} jugadores · página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-muted">Por página:</span>
                <div className="flex gap-1">
                  {[10, 20, 50, 100].map((size) => (
                    <button
                      key={size}
                      onClick={() => setPageSize(size)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        pageSize === size
                          ? 'bg-brand-primary text-white'
                          : 'bg-brand-elevated text-brand-muted active:bg-brand-border'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prev / page numbers / Next */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-elevated text-brand-text disabled:opacity-40 active:bg-brand-border transition-colors"
                >
                  ‹ Anterior
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 py-1.5 text-xs text-brand-muted">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                            page === item
                              ? 'bg-brand-primary text-white'
                              : 'bg-brand-elevated text-brand-muted active:bg-brand-border'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )
                  }
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-elevated text-brand-text disabled:opacity-40 active:bg-brand-border transition-colors"
                >
                  Siguiente ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
