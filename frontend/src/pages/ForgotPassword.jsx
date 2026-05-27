import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el email')
    } finally {
      setLoading(false)
    }
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
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        <h2 className="text-xl font-bold mt-6 mb-1">¿Olvidaste tu contraseña?</h2>
        <p className="text-brand-muted text-sm mb-6">
          Ingresá tu email y te enviamos un enlace para restablecerla.
        </p>

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="bg-green-900/40 border border-green-700 text-green-300 rounded-xl px-4 py-4 text-sm text-center leading-relaxed">
              Si el email está registrado, recibirás un enlace en los próximos minutos. Revisá también tu carpeta de spam.
            </div>
            <Link to="/login" className="btn-primary text-center block">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <p className="text-center text-brand-muted text-sm mt-2">
              <Link to="/login" className="text-brand-primary font-semibold">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
