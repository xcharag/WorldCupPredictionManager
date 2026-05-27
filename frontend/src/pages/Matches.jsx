import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import MatchCard from '../components/MatchCard'
import { MatchListSkeleton } from '../components/Skeletons'
import { useToast, ToastContainer } from '../components/Toast'
import TournamentPredictions from './TournamentPredictions'

const STAGES = [
  { key: 'all', label: 'Todos' },
  { key: 'group_stage', label: 'Grupos' },
  { key: 'round_of_32', label: 'R32' },
  { key: 'round_of_16', label: 'R16' },
  { key: 'quarter_final', label: 'QF' },
  { key: 'semi_final', label: 'SF' },
  { key: 'third_place', label: '3°' },
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
  const [view, setView] = useState('partidos')
  const location = useLocation()
  const [filterUnpredicted, setFilterUnpredicted] = useState(
    () => new URLSearchParams(location.search).get('filter') === 'unpredicted'
  )

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
    if (filterUnpredicted && predictionsByMatch[m._id]) return false
    return true
  }), [matches, stage, selectedGroups, filterDate, filterUnpredicted, predictionsByMatch, showGroupFilters])

  function canEditPrediction(match) {
    if (match.status !== 'scheduled') return false
    return new Date(match.matchDate) > new Date()
  }

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h1 className="section-title mb-3">Predicciones</h1>

      {/* Segment toggle */}
      <div className="flex rounded-xl bg-brand-elevated p-1 mb-4">
        <button
          onClick={() => setView('partidos')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${view === 'partidos' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-muted'}`}
        >
          Partidos
        </button>
        <button
          onClick={() => setView('torneo')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${view === 'torneo' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-muted'}`}
        >
          Tops
        </button>
      </div>

      {view === 'torneo' && <TournamentPredictions embedded />}

      {view === 'partidos' && loading && <MatchListSkeleton embedded />}

      {view === 'partidos' && !loading && <>
      {/* Stage filter */}
      <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar -mx-4 px-4">
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
        {/* Sin predecir toggle */}
        <button
          onClick={() => setFilterUnpredicted(v => !v)}
          className="flex items-center gap-2.5 cursor-pointer select-none w-fit"
        >
          <div className={`relative w-9 h-5 rounded-full transition-colors ${filterUnpredicted ? 'bg-brand-primary' : 'bg-brand-elevated'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${filterUnpredicted ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-xs text-brand-muted">Solo sin predecir</span>
        </button>
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
      </>}
    </div>
  )
}
