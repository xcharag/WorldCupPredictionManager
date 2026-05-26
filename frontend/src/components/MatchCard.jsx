import { format } from '../utils/date'

const STAGE_LABELS = {
  group_stage: 'Fase de grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinal',
  third_place: 'Tercer puesto',
  final: 'Final',
}

const STATUS_CLASS = {
  scheduled: 'badge-gray',
  in_progress: 'badge-green',
  finished: 'badge-amber',
}

function TeamBlock({ team, score, side }) {
  if (!team) return (
    <div className={`flex ${side === 'away' ? 'flex-row-reverse' : 'flex-row'} items-center gap-2 flex-1`}>
      <span className="text-2xl">🏳️</span>
      <span className="text-brand-muted text-sm">Por definir</span>
      {score !== null && score !== undefined && (
        <span className="text-2xl font-bold ml-auto mr-2">{score}</span>
      )}
    </div>
  )

  return (
    <div className={`flex ${side === 'away' ? 'flex-row-reverse' : 'flex-row'} items-center gap-2 flex-1`}>
      <span className="text-2xl">{team.flag || '🏳️'}</span>
      <div className={`flex flex-col ${side === 'away' ? 'items-end' : 'items-start'}`}>
        <span className="font-semibold text-sm leading-none text-center">{team.name || team.shortName}</span>
        {team.name && team.shortName && (
          <span className="text-[11px] text-brand-muted leading-none mt-0.5">{team.shortName}</span>
        )}
      </div>
      {score !== null && score !== undefined && (
        <span className={`text-2xl font-bold ${side === 'home' ? 'ml-auto mr-2' : 'mr-auto ml-2'}`}>{score}</span>
      )}
    </div>
  )
}

export default function MatchCard({ match, prediction, onClick, showPrediction = false }) {
  const isFinished = match.status === 'finished'
  const hasScore = match.homeScore !== null && match.homeScore !== undefined
  const isLocked =
    match.status !== 'scheduled' ||
    (match.matchDate && new Date(match.matchDate).getTime() <= Date.now())

  return (
    <button
      onClick={onClick}
      className={`card w-full text-left transition-colors duration-100 ${
        isLocked
          ? 'border border-red-700/40 bg-red-950/10 opacity-95'
          : 'active:bg-brand-elevated'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`badge ${STATUS_CLASS[match.status] || 'badge-gray'} capitalize`}>
          {match.status === 'in_progress'
            ? 'En juego'
            : match.status === 'scheduled'
            ? 'Programado'
            : 'Finalizado'}
        </span>
        <div className="flex flex-col items-end">
          <span className="text-xs text-brand-muted">{STAGE_LABELS[match.stage] || match.stage}</span>
          {match.group && <span className="text-xs text-brand-muted">Grupo {match.group}</span>}
        </div>
      </div>

      {/* Teams & Score */}
      <div className="flex items-center gap-2">
        <TeamBlock team={match.homeTeam} score={hasScore ? match.homeScore : undefined} side="home" />
        <div className="text-brand-muted font-bold text-sm flex-shrink-0 w-8 text-center">
          {isFinished && hasScore ? '' : '-'}
        </div>
        <TeamBlock team={match.awayTeam} score={hasScore ? match.awayScore : undefined} side="away" />
      </div>

      {/* Date */}
      <p className="text-xs text-brand-muted mt-2 text-center">
        {match.matchDate ? new Date(match.matchDate).toLocaleString('es-ES', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }) : '—'}
        {match.venue && ` · ${match.venue}`}
      </p>

      {isLocked && (
        <div className="mt-2 flex justify-center">
          <span className="badge bg-red-900/35 text-red-300 border border-red-700/40">Bloqueado</span>
        </div>
      )}

      {/* Prediction */}
      {showPrediction && (
        <div className={`mt-3 pt-3 border-t border-brand-border flex items-center justify-between`}>
          {prediction ? (
            <>
              <span className="text-xs text-brand-muted">Tu pronostico:</span>
              <span className="font-bold text-brand-accent">
                {prediction.predictedHomeScore} – {prediction.predictedAwayScore}
              </span>
              {prediction.points !== null && prediction.points !== undefined && (
                <span className="badge-green badge">+{prediction.points} pts</span>
              )}
            </>
          ) : (
            <span className="text-xs text-brand-muted italic">Sin pronostico</span>
          )}
        </div>
      )}
    </button>
  )
}
