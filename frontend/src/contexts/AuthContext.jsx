import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { logTokenInfo, isTokenExpired } from '../utils/jwt'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('wc_token')
    if (!token) { setLoading(false); return }
    
    // Check if token is expired before making API call
    if (isTokenExpired(token)) {
      console.warn('[AuthContext] Token expired, clearing localStorage')
      logTokenInfo(token)
      localStorage.removeItem('wc_token')
      setLoading(false)
      return
    }
    
    // Log token info in development for debugging
    if (import.meta.env.DEV) {
      logTokenInfo(token)
    }
    
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
    } catch (error) {
      // Only clear token on actual auth failures (401), not on network/server errors
      if (error.response?.status === 401) {
        console.error('[AuthContext] Token invalid or expired')
        localStorage.removeItem('wc_token')
        setUser(null)
        throw error
      } else {
        // Network error or server issue - keep the token and retry later
        console.warn('[AuthContext] fetchMe failed but keeping token:', error.message)
        // Still throw to signal failure, but don't clear token
        throw error
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { 
    fetchMe().catch((error) => {
      // On initial load, silently fail for network errors
      // Token was already cleared if it was a 401
      if (error.response?.status !== 401) {
        console.warn('[AuthContext] Initial auth check failed, will retry on next interaction')
      }
    })
  }, [fetchMe])

  const login = async (nickname, password) => {
    const { data } = await api.post('/auth/login', { nickname, password })
    localStorage.setItem('wc_token', data.token)
    if (import.meta.env.DEV) {
      console.log('[AuthContext] Login successful')
      logTokenInfo(data.token)
    }
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    localStorage.setItem('wc_token', data.token)
    if (import.meta.env.DEV) {
      console.log('[AuthContext] Registration successful')
      logTokenInfo(data.token)
    }
    setUser(data.user)
    return data
  }

  const loginWithToken = async (token) => {
    localStorage.setItem('wc_token', token)
    if (import.meta.env.DEV) {
      console.log('[AuthContext] Logging in with OAuth token')
      logTokenInfo(token)
    }
    try {
      await fetchMe()
    } catch (error) {
      // Only clear on auth failures, fetchMe already handles this
      if (error.response?.status === 401) {
        localStorage.removeItem('wc_token')
      }
      throw error
    }
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('wc_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
