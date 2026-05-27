import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: form.password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña')
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

        {!token ? (
          <div className="flex flex-col gap-4 mt-8">
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-4 text-sm text-center">
              El enlace es inválido o ya expiró.
            </div>
            <Link to="/forgot-password" className="btn-primary text-center block">
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : success ? (
          <div className="flex flex-col gap-4 mt-8">
            <div className="bg-green-900/40 border border-green-700 text-green-300 rounded-xl px-4 py-4 text-sm text-center leading-relaxed">
              ¡Contraseña restablecida! Redirigiendo al inicio de sesión...
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mt-6 mb-1">Nueva contraseña</h2>
            <p className="text-brand-muted text-sm mb-6">Ingresá y confirmá tu nueva contraseña.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Nueva contraseña</label>
                <div className="relative">
                  <input
                    className="input pr-12"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                    autoComplete="new-password"
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

              <div>
                <label className="label">Confirmá la contraseña</label>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn-primary mt-2" disabled={loading}>
                {loading ? 'Guardando...' : 'Restablecer contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
