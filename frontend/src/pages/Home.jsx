import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Star, Moon, Sun } from 'lucide-react'

export default function Home() {
  const { user, logout, setUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-brand-bg" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

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

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <QuickCard
            icon={<Users size={28} />}
            title="Mis Grupos"
            desc="Ver y crear grupos"
            onClick={() => navigate('/groups')}
            from="#0E593E" to="#041F15" iconColor="#4ade80"
          />
          <QuickCard
            icon={<Swords size={28} />}
            title="Partidos"
            desc="Predecir partidos"
            onClick={() => navigate('/matches')}
            from="#7A1515" to="#300505" iconColor="#f87171"
          />
          <QuickCard
            icon={<Trophy size={28} />}
            title="Ranking"
            desc="Tabla de posiciones"
            onClick={() => navigate('/leaderboard')}
            from="#5A4200" to="#231900" iconColor="#fbbf24"
          />
          <QuickCard
            icon={<Star size={28} />}
            title="Torneo"
            desc="Predicciones globales"
            onClick={() => navigate('/tournament')}
            from="#081C59" to="#030A21" iconColor="#93c5fd"
          />
        </div>

        {/* Scoring guide */}
        <div className="card mb-6">
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

function QuickCard({ icon, title, desc, onClick, from, to, iconColor }) {
  return (
    <button
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
