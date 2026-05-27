import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import MatchCard from '../components/MatchCard'
import { MatchListSkeleton } from '../components/Skeletons'
import PageHeader from '../components/PageHeader'
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

export default function MatchPredictions() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // matchId -> prediction
  const [stage, setStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState(null)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    Promise.all([
      api.get('/matches'),
      api.get('/predictions/mine'),
      api.get(`/groups/${groupId}`),
    ]).then(([matchRes, predRes, groupRes]) => {
      setMatches(matchRes.data)
      const predMap = {}
      predRes.data.forEach(p => {
        predMap[p.match?._id || p.match] = p
      })
      setPredictions(predMap)
      setGroup(groupRes.data)
    }).finally(() => setLoading(false))
  }, [groupId])

  const filtered = useMemo(() => {
    if (stage === 'all') return matches
    return matches.filter(m => m.stage === stage)
  }, [matches, stage])

  if (loading) return <MatchListSkeleton hasPageHeader />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader
        title="Pronosticos por partido"
        subtitle={group?.name}
        onBack={() => navigate(`/groups/${groupId}`)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Stage filter */}
      <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto no-scrollbar">
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

      <div className="px-4 pt-3 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-brand-muted text-center py-12">No se encontraron partidos.</p>
        ) : (
          filtered.map(match => (
            <MatchCard
              key={match._id}
              match={match}
              prediction={predictions[match._id]}
              showPrediction
              onClick={() => {
                const hasStarted =
                  match.status !== 'scheduled' ||
                  (match.matchDate && new Date(match.matchDate).getTime() <= Date.now())
                if (hasStarted) {
                  addToast('No podes modificar una prediccion de un partido pasado o finalizado.', 'error')
                  return
                }
                navigate(`/groups/${groupId}/matches/${match._id}`)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
