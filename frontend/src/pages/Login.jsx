import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Trophy, Swords, Users, Star, ExternalLink, AlertCircle } from 'lucide-react'
import { isEmbeddedBrowser, getEmbeddedBrowserName, getOpenInBrowserInstructions, openInDefaultBrowser } from '../utils/userAgent'

const OAUTH_ERRORS = {
  google_failed: 'No se pudo iniciar sesión con Google. Por favor intentá de nuevo.',
  auth_failed: 'Error de autenticación. Por favor intentá de nuevo.',
  token_invalid: 'La sesión de Google expiró o es inválida. Por favor intentá de nuevo.',
  disallowed_useragent: 'Google no permite iniciar sesión desde navegadores integrados. Abrí esta página en Chrome, Safari o tu navegador predeterminado.',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ nickname: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inEmbeddedBrowser, setInEmbeddedBrowser] = useState(false)
  const [browserName, setBrowserName] = useState('')

  const from = location.state?.from?.pathname || '/'
  const oauthError = searchParams.get('error')

  useEffect(() => {
    const isEmbedded = isEmbeddedBrowser()
    setInEmbeddedBrowser(isEmbedded)
    if (isEmbedded) {
      setBrowserName(getEmbeddedBrowserName())
      console.warn('[Login] Detected embedded browser:', getEmbeddedBrowserName())
    }
  }, [])

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
    if (inEmbeddedBrowser) {
      // Show alert with instructions
      const proceed = window.confirm(
        `Estás usando ${browserName}. Google no permite iniciar sesión desde navegadores integrados.\n\n` +
        getOpenInBrowserInstructions() + '\n\n' +
        '¿Querés intentar abrir en tu navegador predeterminado?'
      )
      if (proceed) {
        openInDefaultBrowser()
      }
      return
    }
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

      {/* Project description */}
      <div className="px-5 pt-5 pb-2 max-w-md mx-auto w-full">
        <div className="rounded-2xl border border-brand-border bg-brand-elevated px-4 py-4">
          <p className="text-brand-text font-extrabold text-base mb-1 text-center">¿De qué se trata?</p>
          <p className="text-brand-muted text-sm leading-relaxed text-center mb-4">
            Un juego de pronósticos del <span className="text-brand-text font-semibold">Mundial 2026</span>. Predecí
            resultados, elegí al campeón y al goleador, y competí con tus amigos para ver quién sabe más de fútbol.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-brand-muted">
              <Swords size={15} className="text-red-400 flex-shrink-0" />
              <span>Predecí cada partido</span>
            </div>
            <div className="flex items-center gap-2 text-brand-muted">
              <Trophy size={15} className="text-yellow-400 flex-shrink-0" />
              <span>Elegí al campeón</span>
            </div>
            <div className="flex items-center gap-2 text-brand-muted">
              <Users size={15} className="text-green-400 flex-shrink-0" />
              <span>Competí en grupos</span>
            </div>
            <div className="flex items-center gap-2 text-brand-muted">
              <Star size={15} className="text-blue-400 flex-shrink-0" />
              <span>Sumate al ranking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        {/* Embedded browser warning */}
        {inEmbeddedBrowser && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-200 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold mb-1">Navegador no compatible con Google</p>
                <p className="text-yellow-300/90 mb-2">
                  Estás usando {browserName}. Para iniciar sesión con Google, necesitás abrir esta página en Chrome, Safari o tu navegador predeterminado.
                </p>
                <button
                  type="button"
                  onClick={openInDefaultBrowser}
                  className="flex items-center gap-2 text-yellow-100 font-medium hover:text-white transition-colors"
                >
                  <ExternalLink size={16} />
                  Abrir en navegador
                </button>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {oauthError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
              {OAUTH_ERRORS[oauthError] ?? 'Error con Google. Por favor intentá de nuevo.'}
            </div>
          )}
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

          <button 
            type="button" 
            onClick={handleGoogle} 
            className={`btn-secondary flex items-center justify-center gap-2 ${inEmbeddedBrowser ? 'opacity-50' : ''}`}
            title={inEmbeddedBrowser ? 'No disponible en navegadores integrados' : ''}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {inEmbeddedBrowser ? 'Google (no disponible aquí)' : 'Continuar con Google'}
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
