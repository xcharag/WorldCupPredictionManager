import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ nickname: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.nickname, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales invalidas')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="page-no-nav min-h-screen flex flex-col">
      {/* Hero Banner */}
      <div className="relative h-52 overflow-hidden flex-shrink-0">
        <img
          src="/banner-worldcup.jpg"
          alt="FIFA World Cup 2026"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-brand-bg" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <img
            src="/logo-worldcup-medium.png"
            alt="FIFA World Cup Trophy"
            className="w-16 h-16 object-contain drop-shadow-2xl"
          />
          <h1 className="text-2xl font-extrabold text-white drop-shadow-lg">Mundial 2026</h1>
          <p className="text-white/70 text-sm">Pronosticá, competí y ganá.</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Apodo</label>
            <input
              className="input"
              type="text"
              placeholder="tu_apodo"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.nickname}
              onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input
                className="input pr-12"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted"
                onClick={() => setShowPw(s => !s)}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? 'Entrando...' : 'Iniciar sesion'}
          </button>

          <p className="text-right -mt-1">
            <Link to="/forgot-password" className="text-xs text-brand-muted hover:text-brand-primary transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-muted">o</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          <button type="button" onClick={handleGoogle} className="btn-secondary flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continuar con Google
          </button>
        </form>

        <p className="text-center text-brand-muted text-sm mt-6">
          No tenes cuenta?{' '}
          <Link to="/register" className="text-brand-primary font-semibold">Registrate</Link>
        </p>
      </div>
    </div>
  )
}
