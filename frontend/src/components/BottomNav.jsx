import { NavLink, useLocation } from 'react-router-dom'
import { Home, Users, Trophy, Shield, Swords, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/groups', icon: Users, label: 'Grupos' },
  { to: '/matches', icon: Swords, label: 'Partidos' },
  { to: '/', icon: Home, label: 'Inicio', exact: true },
  { to: '/tournament', icon: Star, label: 'Torneo' },
  { to: '/leaderboard', icon: Trophy, label: 'Ranking' },
]

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()

  // Don't show on auth pages or admin pages
  const hide = ['/login', '/register', '/verify-email', '/auth/callback'].some(p =>
    location.pathname.startsWith(p)
  ) || location.pathname.startsWith('/admin')
  if (hide) return null

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
    </nav>
  )
}
