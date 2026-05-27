import { NavLink, useLocation } from 'react-router-dom'
import { Home, Users, Trophy, Shield, Swords } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import MinioImage from './MinioImage'

const NAV = [
  { to: '/groups', icon: Users, label: 'Grupos' },
  { to: '/matches', icon: Swords, label: 'Predicciones' },
  { to: '/', icon: Home, label: 'Inicio', exact: true },
  { to: '/leaderboard', icon: Trophy, label: 'Ranking' },
]

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()

  const hide = ['/login', '/register', '/verify-email', '/auth/callback'].some(p =>
    location.pathname.startsWith(p)
  ) || location.pathname.startsWith('/admin')
  if (hide) return null

  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-surface/95 backdrop-blur-sm border-t-2 border-brand-navy"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch max-w-md mx-auto">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}

        {/* Profile avatar tab */}
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-brand-elevated flex items-center justify-center border border-brand-border">
            {user?.avatar ? (
              <MinioImage src={user.avatar} alt="profile" className="w-full h-full object-cover"
                fallback={<span className="text-[9px] font-bold text-brand-primary leading-none">{initials}</span>}
              />
            ) : (
              <span className="text-[9px] font-bold text-brand-primary leading-none">{initials}</span>
            )}
          </div>
          <span className="text-[10px] font-medium">Perfil</span>
        </NavLink>

        {user?.isAdmin === true && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Shield size={22} />
            <span className="text-[10px] font-medium">Admin</span>
          </NavLink>
        )}
      </div>
      <div className="text-center pb-0.5">
        <a
          href="https://xchar.site"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-brand-muted/50 hover:text-brand-muted transition-colors"
        >
          Desarrollado por xchar
        </a>
      </div>
    </nav>
  )
}
