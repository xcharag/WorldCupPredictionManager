import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="page-no-nav flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {status === 'loading' && <p className="text-brand-muted">Verificando tu correo...</p>}
      {status === 'success' && (
        <>
          <CheckCircle size={56} className="text-brand-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">Correo verificado</h2>
          <p className="text-brand-muted mb-6">Tu cuenta ya esta activa.</p>
          <Link to="/login" className="btn-primary max-w-xs">Ir a iniciar sesion</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle size={56} className="text-brand-danger mb-4" />
          <h2 className="text-xl font-bold mb-2">Enlace invalido</h2>
          <p className="text-brand-muted mb-6">Este enlace es invalido o ya expiro.</p>
          <Link to="/login" className="btn-secondary max-w-xs">Volver a iniciar sesion</Link>
        </>
      )}
    </div>
  )
}
