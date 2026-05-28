import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Star, Moon, Sun, Clock, ChevronRight, Download, HelpCircle, X, Share, Sparkles } from 'lucide-react'
import api from '../services/api'
import { startTour } from '../utils/tour'

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

  // Changelog / Novedades
  const [changelog, setChangelog] = useState([])
  const [showChangelog, setShowChangelog] = useState(false)
  const SEEN_KEY = 'novedades_seen_version'
  const hasUnread = changelog.length > 0 && changelog[0].version !== localStorage.getItem(SEEN_KEY)

  useEffect(() => {
    api.get('/changelog').then(r => setChangelog(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (localStorage.getItem('tour_done')) return
    const t = setTimeout(() => startTour(), 600)
    return () => clearTimeout(t)
  }, [])

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }
    const ua = navigator.userAgent
    if (/iphone|ipad|ipod/i.test(ua)) {
      setIsIOS(true)
      return
    }
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return }
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallPrompt(null); setIsInstalled(true) }
  }

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
            <p className="text-black/60 dark:text-white/60 text-[10px] uppercase tracking-widest font-bold">Bienvenido</p>
            <p className="text-black dark:text-white font-extrabold text-xl leading-tight">@{user?.nickname}</p>
          </div>
          <div className="flex items-center gap-3 pb-0.5">
            <button
              onClick={toggleTheme}
              className="text-black/60 dark:text-white/60 active:text-black dark:active:text-white"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <span className="text-black/30 dark:text-white/30">·</span>
            <button onClick={logout} className="text-black/60 dark:text-white/60 text-xs active:text-black dark:active:text-white">
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
            <h1 className="font-extrabold text-black dark:text-white tracking-tight leading-tight text-base uppercase">FIFA World Cup 2026</h1>
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

        {/* Novedades */}
        {changelog.length > 0 && (
          <button
            onClick={() => {
              setShowChangelog(true)
              if (changelog[0]) localStorage.setItem(SEEN_KEY, changelog[0].version)
            }}
            className="w-full flex items-center gap-3 card mb-4 active:bg-brand-elevated transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0 relative">
              <Sparkles size={18} className="text-brand-primary" />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-accent border-2 border-brand-bg" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold">Novedades</p>
              <p className="text-xs text-brand-muted truncate">
                {hasUnread ? `¡Novedad en v${changelog[0].version}!` : `Última actualización: v${changelog[0].version}`}
              </p>
            </div>
            <ChevronRight size={16} className="text-brand-muted flex-shrink-0" />
          </button>
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

        {/* Install + Tutorial */}
        <div id="tour-install" className="card mb-6 flex flex-col gap-3">
          {!isInstalled && (isIOS || installPrompt) && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 bg-brand-accent/10 border border-brand-accent/30 active:bg-brand-accent/20 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
                <Download size={18} className="text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text">Instalar app</p>
                <p className="text-xs text-brand-muted">Agregala a tu pantalla de inicio</p>
              </div>
              <ChevronRight size={16} className="text-brand-accent flex-shrink-0" />
            </button>
          )}
          <button
            onClick={() => startTour()}
            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 bg-brand-elevated border border-brand-border active:bg-brand-border text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-border flex items-center justify-center flex-shrink-0">
              <HelpCircle size={18} className="text-brand-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-text">Ver tutorial</p>
              <p className="text-xs text-brand-muted">Repasá cómo funciona la app</p>
            </div>
            <ChevronRight size={16} className="text-brand-muted flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* iOS install instructions modal */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-md bg-brand-elevated rounded-2xl p-5 pb-8 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-brand-text text-base">Instalar en iPhone / iPad</p>
              <button onClick={() => setShowIOSModal(false)} className="text-brand-muted active:text-brand-text">
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-brand-muted">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-accent/20 text-brand-accent font-bold flex items-center justify-center flex-shrink-0 text-xs">1</span>
                <span>Tocá el botón <strong className="text-brand-text">Compartir</strong> <Share size={14} className="inline mb-0.5" /> en la barra inferior de Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-accent/20 text-brand-accent font-bold flex items-center justify-center flex-shrink-0 text-xs">2</span>
                <span>Desplazate hacia abajo en el menú y tocá <strong className="text-brand-text">«Agregar a inicio»</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-accent/20 text-brand-accent font-bold flex items-center justify-center flex-shrink-0 text-xs">3</span>
                <span>Confirmá tocando <strong className="text-brand-text">Agregar</strong> en la esquina superior derecha.</span>
              </li>
            </ol>
            <p className="text-xs text-brand-muted mt-4">
              ⚠ Esta función solo está disponible en <strong className="text-brand-text">Safari</strong>. Si usás Chrome u otro navegador en iOS, abrí la página en Safari primero.
            </p>
          </div>
        </div>
      )}

      {/* Novedades modal */}
      {showChangelog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowChangelog(false)}
        >
          <div
            className="w-full max-w-md bg-brand-elevated rounded-2xl shadow-xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-brand-primary" />
                <p className="font-bold text-brand-text">Novedades</p>
              </div>
              <button onClick={() => setShowChangelog(false)} className="text-brand-muted active:text-brand-text">
                <X size={20} />
              </button>
            </div>

            {/* Entries */}
            <div className="overflow-y-auto px-5 py-4 space-y-5">
              {changelog.map((entry, idx) => (
                <div key={entry.version}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-brand-primary text-white' : 'bg-brand-elevated text-brand-muted border border-brand-border'}`}>
                      v{entry.version}
                    </span>
                    <span className="text-xs text-brand-muted">
                      {new Date(entry.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-brand-text mb-2">{entry.title}</p>
                  <ul className="space-y-1.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-brand-muted">
                        <span className="text-brand-primary mt-0.5 flex-shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {idx < changelog.length - 1 && <div className="mt-5 border-t border-brand-border" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
