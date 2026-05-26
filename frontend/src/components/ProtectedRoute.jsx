import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner fullScreen />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (adminOnly && user.isAdmin !== true) return <Navigate to="/" replace />

  return children
}
