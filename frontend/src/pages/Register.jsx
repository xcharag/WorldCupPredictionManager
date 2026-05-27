import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('inviteCode') || ''

  const [form, setForm] = useState({ name: '', nickname: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      const data = await register({ ...form, inviteCode })
      if (data.inviteCode) {
        navigate(`/join/${data.inviteCode}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        const mapped = {}
        apiErrors.forEach(e => { mapped[e.path] = e.msg })
        setErrors(mapped)
      } else {
        setErrors({ general: err.response?.data?.message || 'Registro fallido' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-no-nav min-h-screen flex flex-col">
      {/* Hero Banner */}
      <div className="relative h-44 overflow-hidden flex-shrink-0">
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
            className="w-14 h-14 object-contain drop-shadow-2xl"
          />
          <h1 className="text-2xl font-extrabold text-white drop-shadow-lg">Crear cuenta</h1>
          <p className="text-white/70 text-sm">Unete a las predicciones del Mundial 2026</p>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        {inviteCode && (
          <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl px-4 py-3 mb-4 text-sm text-brand-primary">
            Te invitaron. Registrate para unirte al grupo.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errors.general && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
              {errors.general}
            </div>
          )}

          <div>
            <label className="label">Nombre completo</label>
            <input className={`input ${errors.name ? 'border-red-600' : ''}`} type="text"
              placeholder="Juan Perez" value={form.name} onChange={set('name')} required />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Apodo <span className="text-brand-muted">(unico, se usa para entrar)</span></label>
            <input className={`input ${errors.nickname ? 'border-red-600' : ''}`} type="text"
              placeholder="juan_perez" autoCapitalize="none" autoCorrect="off"
              value={form.nickname} onChange={set('nickname')} required />
            {errors.nickname && <p className="text-red-400 text-xs mt-1">{errors.nickname}</p>}
          </div>

          <div>
            <label className="label">Correo</label>
            <input className={`input ${errors.email ? 'border-red-600' : ''}`} type="email"
              placeholder="tu@correo.com" value={form.email} onChange={set('email')} required />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="label">Contrasena</label>
            <div className="relative">
              <input className={`input pr-12 ${errors.password ? 'border-red-600' : ''}`}
                type={showPw ? 'text' : 'password'} placeholder="Minimo 6 caracteres"
                value={form.password} onChange={set('password')} required />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted"
                onClick={() => setShowPw(s => !s)}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-brand-muted text-sm mt-6">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-brand-primary font-semibold">Inicia sesion</Link>
        </p>
      </div>
    </div>
  )
}
