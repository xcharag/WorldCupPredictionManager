import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('wc_token')
    if (!token) { setLoading(false); return }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
    } catch {
      localStorage.removeItem('wc_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMe() }, [fetchMe])

  const login = async (nickname, password) => {
    const { data } = await api.post('/auth/login', { nickname, password })
    localStorage.setItem('wc_token', data.token)
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    localStorage.setItem('wc_token', data.token)
    setUser(data.user)
    return data
  }

  const loginWithToken = (token) => {
    localStorage.setItem('wc_token', token)
    return fetchMe()
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
