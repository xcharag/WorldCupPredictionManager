import { useState, useEffect } from 'react'
import api from '../services/api'
import MinioImage from './MinioImage'

function TeamFlag({ team }) {
  if (team?.badgeUrl) {
    return (
      <MinioImage
        src={team.badgeUrl}
        alt={team.shortName}
        className="w-5 h-5 object-contain flex-shrink-0"
        fallback={<span className="text-base leading-none">{team?.flag || '🏳️'}</span>}
      />
    )
  }
  return <span className="text-base leading-none flex-shrink-0">{team?.flag || '🏳️'}</span>
}

function GroupTable({ group, rows }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
          {group}
        </span>
        <span className="text-sm font-bold text-brand-text">Grupo {group}</span>
      </div>

      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
        {/* Header */}
        <div className="grid text-[10px] font-semibold text-brand-muted px-3 py-1.5 border-b border-brand-border"
          style={{ gridTemplateColumns: '1fr 20px 20px 20px 24px 24px 28px' }}>
          <span>Equipo</span>
          <span className="text-center">PJ</span>
          <span className="text-center">G</span>
          <span className="text-center">E</span>
          <span className="text-center">P</span>
          <span className="text-center">DG</span>
          <span className="text-right">Pts</span>
        </div>

        {rows.map((row, idx) => {
          const qualified = idx < 2
          return (
            <div
              key={String(row.team._id)}
              className={`grid items-center px-3 py-2 border-b border-brand-border last:border-0 text-sm
                ${qualified ? 'bg-brand-primary/5' : ''}`}
              style={{ gridTemplateColumns: '1fr 20px 20px 20px 24px 24px 28px' }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-brand-muted w-3 flex-shrink-0">{idx + 1}</span>
                <TeamFlag team={row.team} />
                <span className="truncate text-xs font-medium">{row.team.shortName || row.team.name}</span>
                {qualified && (
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-primary" title="Clasifica" />
                )}
              </div>
              <span className="text-center text-xs text-brand-muted">{row.played}</span>
              <span className="text-center text-xs text-brand-muted">{row.won}</span>
              <span className="text-center text-xs text-brand-muted">{row.drawn}</span>
              <span className="text-center text-xs text-brand-muted">{row.lost}</span>
              <span className={`text-center text-xs font-medium ${row.goalDiff > 0 ? 'text-brand-primary' : row.goalDiff < 0 ? 'text-brand-danger' : 'text-brand-muted'}`}>
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </span>
              <span className="text-right text-sm font-bold text-brand-text">{row.points}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GroupStandings() {
  const [standings, setStandings] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/matches/standings')
      .then(r => {
        setStandings(r.data.standings)
        setUpdatedAt(r.data.updatedAt)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 mt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden animate-pulse">
            <div className="h-8 bg-brand-elevated border-b border-brand-border" />
            {[...Array(4)].map((__, j) => (
              <div key={j} className="h-10 border-b border-brand-border last:border-0 px-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-elevated" />
                <div className="h-2 w-20 rounded bg-brand-elevated" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!standings || Object.keys(standings).length === 0) {
    return <p className="text-brand-muted text-center py-12 text-sm">No hay datos de posiciones todavía.</p>
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-brand-muted flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-primary" />
          Los dos primeros de cada grupo clasifican directamente
        </p>
        {updatedAt && (
          <p className="text-[10px] text-brand-muted/60">
            Act. {new Date(updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      {Object.entries(standings).map(([group, rows]) => (
        <GroupTable key={group} group={group} rows={rows} />
      ))}
    </div>
  )
}
