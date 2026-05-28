import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import api from '../services/api'
import PageHeader from '../components/PageHeader'
import MinioImage from '../components/MinioImage'
import { useAuth } from '../contexts/AuthContext'

const STAGE_LABELS = {
  group_stage: 'Fase de grupos',
  round_of_32: 'Ronda de 32',
  round_of_16: 'Octavos de final',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinales',
  third_place: 'Tercer puesto',
  final: 'Final',
}

function outcomeLabel(pred, match) {
  const predHome = pred.predictedHomeScore
  const predAway = pred.predictedAwayScore
  const realHome = match.homeScore
  const realAway = match.awayScore

  const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw'

  if (predHome === realHome && predAway === realAway) return { label: 'Exacto', color: 'text-brand-primary bg-brand-primary/10' }
  if (predWinner === realWinner) return { label: 'Resultado', color: 'text-blue-400 bg-blue-500/10' }
  return { label: 'Fallido', color: 'text-brand-muted bg-brand-elevated' }
}

function PredictionCard({ pred }) {
  const { match } = pred
  if (!match) return null

  const outcome = outcomeLabel(pred, match)
  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam

  return (
    <div className="card mb-3">
      {/* Stage + outcome */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-brand-muted uppercase tracking-wide font-semibold">
          {STAGE_LABELS[match.stage] || match.stage}
        </span>
        <div className="flex items-center gap-1.5">
          {pred.points !== null && (
            <span className="text-xs font-bold text-brand-primary">+{pred.points} pts</span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${outcome.color}`}>
            {outcome.label}
          </span>
        </div>
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {homeTeam?.badgeUrl ? (
            <MinioImage src={homeTeam.badgeUrl} alt={homeTeam.shortName} className="w-6 h-6 object-contain flex-shrink-0"
              fallback={<span className="text-lg leading-none">{homeTeam?.flag}</span>}
            />
          ) : (
            <span className="text-lg leading-none">{homeTeam?.flag || '🏳️'}</span>
          )}
          <span className="text-sm font-semibold truncate">{homeTeam?.shortName || 'Por definir'}</span>
        </div>

        {/* Scores */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <span className="text-xs text-brand-muted leading-none">Real</span>
          <span className="text-base font-bold">{match.homeScore} – {match.awayScore}</span>
          <span className="text-xs text-brand-muted leading-none">Pred.</span>
          <span className="text-sm font-semibold text-brand-primary">{pred.predictedHomeScore} – {pred.predictedAwayScore}</span>
        </div>

        {/* Away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate">{awayTeam?.shortName || 'Por definir'}</span>
          {awayTeam?.badgeUrl ? (
            <MinioImage src={awayTeam.badgeUrl} alt={awayTeam.shortName} className="w-6 h-6 object-contain flex-shrink-0"
              fallback={<span className="text-lg leading-none">{awayTeam?.flag}</span>}
            />
          ) : (
            <span className="text-lg leading-none">{awayTeam?.flag || '🏳️'}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UserProfile() {
  const { userId } = useParams()
  const { user: me } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPredictions, setShowPredictions] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  useEffect(() => {
    api.get(`/users/${userId}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Perfil" />
      <div className="px-4 pt-6 space-y-4 animate-pulse">
        <div className="card flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-elevated flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-brand-elevated" />
            <div className="h-3 w-20 rounded bg-brand-elevated" />
            <div className="h-3 w-24 rounded bg-brand-elevated" />
          </div>
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-brand-elevated" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Perfil" />
      <p className="text-center text-brand-muted mt-10">Usuario no encontrado</p>
    </div>
  )

  const { user, predictions } = data
  const initials = user.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const ft = user.favoriteTeam
  const isMe = me?._id === userId

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title={isMe ? 'Mi perfil' : 'Perfil'} />

      <div className="px-4 pt-4 space-y-4">
        {/* User card */}
        <div className="card flex items-center gap-4">
          {/* Avatar */}
          <div
            className={`w-20 h-20 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center flex-shrink-0 border-2 border-brand-border ${user.avatar ? 'cursor-zoom-in active:scale-95 transition-transform' : ''}`}
            onClick={() => user.avatar && setAvatarOpen(true)}
          >
            {user.avatar ? (
              <MinioImage src={user.avatar} alt={user.nickname} className="w-full h-full object-cover"
                fallback={<span className="text-2xl font-bold text-brand-primary">{initials}</span>}
              />
            ) : (
              <span className="text-2xl font-bold text-brand-primary">{initials}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight truncate">{user.name}</p>
            <p className="text-brand-muted text-sm">@{user.nickname}</p>

            {ft && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {ft.badgeUrl ? (
                  <MinioImage src={ft.badgeUrl} alt={ft.shortName} className="w-5 h-5 object-contain"
                    fallback={<span className="text-base">{ft.flag}</span>}
                  />
                ) : (
                  <span className="text-base">{ft.flag}</span>
                )}
                <span className="text-sm text-brand-muted">{ft.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Predictions section */}
        {predictions.length > 0 ? (
          <div>
            <button
              onClick={() => setShowPredictions(v => !v)}
              className="w-full card flex items-center justify-between text-left active:bg-brand-elevated mb-3"
            >
              <div>
                <p className="font-semibold">Pronosticos de partidos</p>
                <p className="text-xs text-brand-muted mt-0.5">{predictions.length} partidos finalizados</p>
              </div>
              <span className="text-brand-muted text-lg">{showPredictions ? '▲' : '▼'}</span>
            </button>

            {showPredictions && predictions.map(pred => (
              <PredictionCard key={pred._id} pred={pred} />
            ))}
          </div>
        ) : (
          <div className="card text-center py-6">
            <p className="text-brand-muted text-sm">
              {isMe ? 'Todavía no tenés pronosticos en partidos finalizados.' : 'Este usuario no tiene pronosticos visibles aún.'}
            </p>
          </div>
        )}
      </div>

      {/* Avatar lightbox */}
      {avatarOpen && user.avatar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setAvatarOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setAvatarOpen(false)}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div
            className="w-72 h-72 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <MinioImage
              src={user.avatar}
              alt={user.nickname}
              className="w-full h-full object-cover"
              fallback={<span className="w-full h-full flex items-center justify-center text-6xl font-bold text-brand-primary bg-brand-elevated">{initials}</span>}
            />
          </div>
        </div>
      )}
    </div>
  )
}
