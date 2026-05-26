import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

// Handles the redirect from Google OAuth
export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      loginWithToken(token).then(() => navigate('/', { replace: true }))
    } else {
      navigate('/login?error=auth_failed', { replace: true })
    }
  }, [])

  return <LoadingSpinner fullScreen />
}
