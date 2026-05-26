import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Trophy, Users, Swords, Star } from 'lucide-react'

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">
            🌍 Mundial <span className="text-brand-primary">2026</span>
          </h1>
          <p className="text-brand-muted text-sm">Hola, <span className="text-brand-text font-medium">@{user?.nickname}</span></p>
        </div>
        <button onClick={logout} className="text-brand-muted text-sm active:text-brand-text">
          Salir
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <QuickCard
          icon={<Users size={28} className="text-brand-primary" />}
          title="Mis Grupos"
          desc="Ver y crear grupos de predicción"
          onClick={() => navigate('/groups')}
          color="green"
        />
        <QuickCard
          icon={<Swords size={28} className="text-brand-accent" />}
          title="Partidos"
          desc="Predecir próximos partidos"
          onClick={() => navigate('/matches')}
          color="amber"
        />
        <QuickCard
          icon={<Trophy size={28} className="text-purple-400" />}
          title="Tabla de posiciones"
          desc="Mira cómo te posicionas"
          onClick={() => navigate('/leaderboard')}
          color="purple"
        />
        <QuickCard
          icon={<Star size={28} className="text-blue-400" />}
          title="Torneo"
          desc="Predicciones del torneo"
          onClick={() => navigate('/tournament')}
          color="blue"
        />
      </div>

      {/* Email verification banner */}
      {user && !user.isEmailVerified && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-amber-300">
            📧 Por favor, verifica tu correo electrónico para desbloquear todas las funciones. Revisa tu bandeja de entrada.
          </p>
        </div>
      )}

      {/* Scoring guide */}
      <div className="card">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-brand-accent" /> Guía de puntuación
        </h2>
        <div className="space-y-2 text-sm">
          {[
            ['Resultado correcto (gana o empate)', '+2 pts'],
            ['Marcador exacto', '+1 bono'],
            ['Un marcador correcto', '+1 bono'],
            ['Ambos marcadores correctos', '+2 bono'],
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
  )
}

function QuickCard({ icon, title, desc, onClick, color }) {
  const borders = { green: 'border-brand-primary/30', amber: 'border-amber-500/30', purple: 'border-purple-500/30', blue: 'border-blue-500/30' }
  return (
    <button
      onClick={onClick}
      className={`card text-left active:bg-brand-elevated border ${borders[color] || 'border-brand-border'} transition-colors`}
    >
      <div className="mb-2">{icon}</div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-brand-muted mt-0.5">{desc}</p>
    </button>
  )
}
