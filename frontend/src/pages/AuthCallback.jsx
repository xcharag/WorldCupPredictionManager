import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

// Handles the redirect from Google OAuth
export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasProcessed.current) return
    hasProcessed.current = true

    const token = searchParams.get('token')
    
    if (!token) {
      console.error('[AuthCallback] No token received from OAuth callback')
      navigate('/login?error=auth_failed', { replace: true })
      return
    }

    loginWithToken(token)
      .then(() => {
        console.log('[AuthCallback] Successfully logged in with token')
        navigate('/', { replace: true })
      })
      .catch((error) => {
        console.error('[AuthCallback] Failed to login with token:', error)
        localStorage.removeItem('wc_token')
        navigate('/login?error=token_invalid', { replace: true })
      })
  }, [searchParams, loginWithToken, navigate])

  return <LoadingSpinner fullScreen />
}
