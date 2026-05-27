import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Star, Moon, Sun, Clock, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOURNAMENT_FIELDS = ['champion', 'runnerUp', 'topScorer', 'topAssister', 'mostYellowCards', 'mostRedCards']

function getTimeLeft(targetDate) {
  if (!targetDate) return null
  const diff = new Date(targetDate) - Date.now()
  if (diff <= 0) return null
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  }
}

function formatCountdown(t) {
  if (!t) return 'Pronto'
  if (t.d > 0) return `${t.d}d ${t.h}h`
  if (t.h > 0) return `${t.h}h ${t.m}m`
  return `${t.m}m ${t.s}s`
}

export default function Home() {
  const { user, logout, setUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [nextUnpredicted, setNextUnpredicted] = useState(null)
  const [tournamentPending, setTournamentPending] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [pendingLoading, setPendingLoading] = useState(true)

  // Onboarding tour — shown once per device
  useEffect(() => {
    if (localStorage.getItem('tour_done')) return
    const t = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Atrás',
        doneBtnText: '¡Listo!',
        overlayColor: 'rgba(0,0,0,0.75)',
        popoverClass: 'tour-popover',
        steps: [
          {
            popover: {
              title: '¡Bienvenido al Concurso del Mundial 2026! 🏆',
              description:
                'Este es un juego de pronósticos. Predecís los resultados de los 104 partidos del Mundial, elegís al campeón, al goleador y más — y competís con amigos para ver quién sabe más de fútbol.',
              side: 'over',
              align: 'center',
            },
          },
          {
            element: '#tour-partidos',
            popover: {
              title: '⚽ Partidos',
              description:
                'Aquí predecís el resultado de cada partido <strong>antes de que empiece</strong>. Podés ganar hasta 5 puntos por partido si acertás el marcador exacto.',
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '#tour-grupos',
            popover: {
              title: '👥 Mis Grupos',
              description:
                'Creá un grupo privado o unite al de tus amigos para tener una tabla de posiciones propia y competir entre ustedes.',
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '#tour-ranking',
            popover: {
              title: '🏅 Ranking',
              description:
                'Seguí tu posición en el ranking global y mirá cómo van los demás participantes a medida que avanzan los partidos.',
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '#tour-torneo',
            popover: {
              title: '⭐ Torneo',
              description:
                'Antes de que arranque el torneo podés predecir el campeón, el goleador, el asistidor y más. ¡Estos pronósticos valen muchos puntos!',
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '#tour-scoring',
            popover: {
              title: '📊 Sistema de puntuación',
              description:
                'Repasá cómo se puntúa. Un pronóstico perfecto (resultado exacto) vale 5 puntos. Los pronósticos del torneo pueden darte hasta 50 puntos extra.',
              side: 'top',
              align: 'center',
            },
          },
        ],
        onDestroyed: () => localStorage.setItem('tour_done', '1'),
      })
      driverObj.drive()
    }, 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const now = Date.now()
    Promise.all([
      api.get('/matches'),
      api.get('/predictions/mine'),
      api.get('/predictions/tournament'),
    ]).then(([matchesRes, predictionsRes, tournRes]) => {
      const predicted = new Set(
        predictionsRes.data.map(p => typeof p.match === 'string' ? p.match : p.match?._id)
      )
      const upcoming = matchesRes.data
        .filter(m => m.status === 'scheduled' && new Date(m.matchDate) > now && !predicted.has(m._id))
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate))
      if (upcoming.length > 0) {
        setNextUnpredicted({ match: upcoming[0], count: upcoming.length })
        setCountdown(getTimeLeft(upcoming[0].matchDate))
      }
      const { isLocked, prediction } = tournRes.data
      if (!isLocked) {
        const missing = prediction ? TOURNAMENT_FIELDS.filter(f => !prediction[f]).length : 6
        if (missing > 0) setTournamentPending({ missingCount: missing })
      }
    }).catch(() => {}).finally(() => setPendingLoading(false))
  }, [])

  useEffect(() => {
    if (!nextUnpredicted) return
    const id = setInterval(() => setCountdown(getTimeLeft(nextUnpredicted.match.matchDate)), 1000)
    return () => clearInterval(id)
  }, [nextUnpredicted])

  return (
    <div className="min-h-screen bg-brand-bg" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Hero Banner */}
      <div className="relative h-44 overflow-hidden">
        <img
          src="/banner-worldcup.jpg"
          alt="FIFA World Cup 2026"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-brand-bg" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 flex items-end justify-between">
          <div>
            <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Bienvenido</p>
            <p className="text-white font-extrabold text-xl leading-tight">@{user?.nickname}</p>
          </div>
          <div className="flex items-center gap-3 pb-0.5">
            <button
              onClick={toggleTheme}
              className="text-white/60 active:text-white"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <span className="text-white/30">·</span>
            <button onClick={logout} className="text-white/60 text-xs active:text-white">
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        {/* Logo + branding */}
        <div className="flex items-center gap-3 pt-4 pb-3">
          <img src="/logo-worldcup-medium.png" alt="World Cup Trophy" className="w-12 h-12 object-contain drop-shadow" />
          <div>
            <h1 className="font-extrabold text-white tracking-tight leading-tight text-base uppercase">FIFA World Cup 2026</h1>
            <p className="text-brand-accent text-[11px] font-bold uppercase tracking-widest">Demostra tu futbol</p>
          </div>
        </div>

        {/* Email verification banner */}
        {user && !user.isEmailVerified && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 dark:bg-amber-900/30 dark:border-amber-700/50">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              📧 Por favor, verifica tu correo electrónico para desbloquear todas las funciones. Revisa tu bandeja de entrada y/o Spam.
            </p>
          </div>
        )}

        {/* Pending */}
        {pendingLoading ? (
          <div className="mb-5 animate-pulse">
            <div className="h-2.5 w-20 rounded-full bg-brand-elevated mb-2" />
            <div className="card flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-xl bg-brand-elevated flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3.5 w-32 rounded bg-brand-elevated" />
                <div className="h-2.5 w-48 rounded bg-brand-elevated" />
              </div>
            </div>
          </div>
        ) : (nextUnpredicted || tournamentPending) ? (
          <div className="mb-5">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">⚠ Pendiente</p>
            <div className="flex flex-col gap-2">
              {nextUnpredicted && (
                <button
                  onClick={() => navigate('/matches?filter=unpredicted')}
                  className="card border border-red-500/30 bg-red-500/5 flex items-center gap-3 text-left active:bg-red-500/10 w-full"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <Clock size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text">
                      {nextUnpredicted.count === 1 ? '1 partido sin predecir' : `${nextUnpredicted.count} partidos sin predecir`}
                    </p>
                    <p className="text-xs text-brand-muted truncate">
                      Próximo: {nextUnpredicted.match.homeTeam?.name} vs {nextUnpredicted.match.awayTeam?.name} · en {countdown ? formatCountdown(countdown) : '...'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-red-400 flex-shrink-0" />
                </button>
              )}
              {tournamentPending && (
                <button
                  onClick={() => navigate('/tournament')}
                  className="card border border-red-500/30 bg-red-500/5 flex items-center gap-3 text-left active:bg-red-500/10 w-full"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <Trophy size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text">Tops del torneo incompletos</p>
                    <p className="text-xs text-brand-muted">
                      {tournamentPending.missingCount === 6
                        ? 'Aún no completaste tus predicciones del torneo'
                        : `Faltan ${tournamentPending.missingCount} de 6 campos`}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-red-400 flex-shrink-0" />
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <QuickCard
            id="tour-grupos"
            icon={<Users size={28} />}
            title="Mis Grupos"
            desc="Ver y crear grupos"
            onClick={() => navigate('/groups')}
            from="#0E593E" to="#041F15" iconColor="#4ade80"
          />
          <QuickCard
            id="tour-partidos"
            icon={<Swords size={28} />}
            title="Partidos"
            desc="Predecir partidos"
            onClick={() => navigate('/matches')}
            from="#7A1515" to="#300505" iconColor="#f87171"
          />
          <QuickCard
            id="tour-ranking"
            icon={<Trophy size={28} />}
            title="Ranking"
            desc="Tabla de posiciones"
            onClick={() => navigate('/leaderboard')}
            from="#5A4200" to="#231900" iconColor="#fbbf24"
          />
          <QuickCard
            id="tour-torneo"
            icon={<Star size={28} />}
            title="Torneo"
            desc="Predicciones globales"
            onClick={() => navigate('/tournament')}
            from="#081C59" to="#030A21" iconColor="#93c5fd"
          />
        </div>

        {/* Scoring guide */}
        <div id="tour-scoring" className="card mb-6">
          <p className="font-bold text-brand-text mb-3 text-sm">Sistema de puntuación</p>
          <div className="space-y-1 text-sm">
            {[
              ['Ganador o Empate', '+2 pts'],
              ['Un marcador correcto', '+1 bono'],
              ['Resultado Correcto', '+2 bono'],
              ['Pronostico perfecto', '= 5 pts'],
            ].map(([label, pts]) => (
              <div key={label} className="flex justify-between text-brand-muted">
                <span>{label}</span>
                <span className="font-semibold text-brand-text">{pts}</span>
              </div>
            ))}
            <div className="border-t border-brand-border pt-2 mt-2">
              <p className="text-xs text-brand-muted font-semibold mb-1">Pronosticos del torneo:</p>
              {[
                ['Campeon', '+50 pts'],
                ['Subcampeon', '+30 pts'],
                ['Maximo goleador / asistidor', '+30 / +20 pts'],
                ['Mas tarjetas amarillas/rojas', '+20 pts'],
              ].map(([label, pts]) => (
                <div key={label} className="flex justify-between text-brand-muted">
                  <span>{label}</span>
                  <span className="font-semibold text-brand-text">{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickCard({ id, icon, title, desc, onClick, from, to, iconColor }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-4 text-left active:scale-[0.97] transition-transform duration-100 min-h-[110px] flex flex-col justify-between"
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
    >
      <div style={{ color: iconColor }}>{icon}</div>
      <div>
        <p className="font-extrabold text-sm text-white leading-tight">{title}</p>
        <p className="text-[11px] mt-0.5 text-white/60">{desc}</p>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />
    </button>
  )
}
