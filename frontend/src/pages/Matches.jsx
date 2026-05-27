import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import MatchCard from '../components/MatchCard'
import { MatchListSkeleton } from '../components/Skeletons'
import { useToast, ToastContainer } from '../components/Toast'

const STAGES = [
  { key: 'all', label: 'Todos' },
  { key: 'group_stage', label: 'Grupos' },
  { key: 'round_of_32', label: 'R32' },
  { key: 'round_of_16', label: 'R16' },
  { key: 'quarter_final', label: 'QF' },
  { key: 'semi_final', label: 'SF' },
  { key: 'final', label: 'Final' },
]

export default function Matches() {
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const [matches, setMatches] = useState([])
  const [predictionsByMatch, setPredictionsByMatch] = useState({})
  const [stage, setStage] = useState('all')
  const [selectedGroups, setSelectedGroups] = useState([])
  const [filterDate, setFilterDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/matches'), api.get('/predictions/mine')])
      .then(([matchesRes, predictionsRes]) => {
        setMatches(matchesRes.data)
        const map = {}
        predictionsRes.data.forEach((p) => {
          const matchId = typeof p.match === 'string' ? p.match : p.match?._id
          if (matchId) map[matchId] = p
        })
        setPredictionsByMatch(map)
      })
      .finally(() => setLoading(false))
  }, [])

  const showGroupFilters = stage === 'all' || stage === 'group_stage'

  const availableGroups = useMemo(() => (
    [...new Set(matches.filter(m => m.stage === 'group_stage' && m.group).map(m => m.group))].sort()
  ), [matches])

  const filtered = useMemo(() => matches.filter(m => {
    if (stage !== 'all' && m.stage !== stage) return false
    if (showGroupFilters && selectedGroups.length > 0 && !selectedGroups.includes(m.group)) return false
    if (filterDate) {
      const matchDay = new Date(m.matchDate).toISOString().slice(0, 10)
      if (matchDay !== filterDate) return false
    }
    return true
  }), [matches, stage, selectedGroups, filterDate, showGroupFilters])

  function canEditPrediction(match) {
    if (match.status !== 'scheduled') return false
    return new Date(match.matchDate) > new Date()
  }

  if (loading) return <MatchListSkeleton />

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h1 className="section-title mb-4">Partidos</h1>

      {/* Stage filter */}
      <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => { setStage(s.key); setSelectedGroups([]) }}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
              ${stage === s.key ? 'bg-brand-primary text-white' : 'bg-brand-elevated text-brand-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="flex flex-col gap-2 mb-3">
        {/* Date */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-brand-muted w-16 flex-shrink-0">Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="input flex-1 text-sm py-1.5"
          />
          {filterDate && (
            <button onClick={() => setFilterDate('')} className="text-xs text-brand-muted underline flex-shrink-0">
              Limpiar
            </button>
          )}
        </div>

        {/* Group multi-select pills — group stage only */}
        {showGroupFilters && availableGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-brand-muted w-16 flex-shrink-0">Grupo</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {availableGroups.map(g => {
                const active = selectedGroups.includes(g)
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedGroups(prev =>
                      active ? prev.filter(x => x !== g) : [...prev, g]
                    )}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors
                      ${active ? 'bg-brand-primary text-white' : 'bg-brand-elevated text-brand-muted'}`}
                  >
                    {g}
                  </button>
                )
              })}
              {selectedGroups.length > 0 && (
                <button
                  onClick={() => setSelectedGroups([])}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-elevated text-brand-muted underline"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-brand-muted text-center py-12">No se encontraron partidos.</p>
        ) : (
          filtered.map(match => (
            <MatchCard
              key={match._id}
              match={match}
              prediction={predictionsByMatch[match._id]}
              showPrediction
              onClick={() => {
                if (!canEditPrediction(match)) {
                  addToast('No podes modificar una prediccion de un partido pasado o finalizado.', 'error')
                  return
                }
                navigate(`/matches/${match._id}`)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
