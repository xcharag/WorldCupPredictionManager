import { useNavigate } from 'react-router-dom'
import { BarChart3, Swords, Users, ShieldCheck, Trophy, Settings } from 'lucide-react'

const SECTIONS = [
  { icon: Swords, label: 'Partidos', desc: 'Gestionar calendario y resultados', to: '/admin/matches', color: 'text-brand-accent' },
  { icon: Users, label: 'Equipos', desc: 'Gestionar equipos del Mundial', to: '/admin/teams', color: 'text-blue-400' },
  { icon: ShieldCheck, label: 'Plantillas', desc: 'Gestionar jugadores por equipo', to: '/admin/rosters', color: 'text-purple-400' },
  { icon: Trophy, label: 'Resultados del torneo', desc: 'Definir resultados finales', to: '/admin/results', color: 'text-brand-accent' },
  { icon: BarChart3, label: 'Puntuacion', desc: 'Recalcular puntos', to: '/admin/scoring', color: 'text-brand-primary' },
  { icon: Settings, label: 'Configuracion', desc: 'Bloquear pronosticos del torneo', to: '/admin/settings', color: 'text-brand-muted' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  return (
    <div className="page max-w-md mx-auto px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <ShieldCheck className="text-brand-primary" size={26} /> Panel de administracion
        </h1>
        <p className="text-brand-muted text-sm mt-1">Mundial FIFA 2026</p>
        <button
          onClick={() => navigate('/')}
          className="btn-secondary mt-3"
        >
          Volver al menu principal
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {SECTIONS.map(({ icon: Icon, label, desc, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="card flex items-center gap-4 text-left active:bg-brand-elevated"
          >
            <div className="w-12 h-12 bg-brand-elevated rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon size={24} className={color} />
            </div>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-xs text-brand-muted">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
