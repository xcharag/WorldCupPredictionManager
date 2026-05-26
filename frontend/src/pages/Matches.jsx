import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import MatchCard from '../components/MatchCard'
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

  const filtered = stage === 'all' ? matches : matches.filter(m => m.stage === stage)

  function canEditPrediction(match) {
    if (match.status !== 'scheduled') return false
    return new Date(match.matchDate) > new Date()
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h1 className="section-title mb-4">Partidos</h1>

      {/* Stage filter */}
      <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setStage(s.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
              ${stage === s.key ? 'bg-brand-primary text-white' : 'bg-brand-elevated text-brand-muted'}`}
          >
            {s.label}
          </button>
        ))}
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
