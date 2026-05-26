import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { Users, CheckCircle } from 'lucide-react'
import { Trophy } from 'lucide-react'

export default function JoinGroup() {
  const { inviteCode } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groupInfo, setGroupInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/groups/join/${inviteCode}`)
      .then(r => setGroupInfo(r.data))
      .catch(() => setError('Este enlace de invitacion es invalido o expiro.'))
      .finally(() => setLoading(false))
  }, [inviteCode])

  const handleJoin = async () => {
    if (!user) {
      navigate(`/register?inviteCode=${inviteCode}`)
      return
    }
    setJoining(true)
    try {
      const { data } = await api.post(`/groups/join/${inviteCode}`)
      setJoined(true)
      setTimeout(() => navigate(`/groups/${data.group._id}`), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo unir al grupo')
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page-no-nav min-h-screen flex flex-col items-center justify-center px-5 max-w-md mx-auto">
      <div className="w-16 h-16 bg-brand-primary/20 rounded-2xl flex items-center justify-center mb-6">
        <Trophy size={32} className="text-brand-primary" />
      </div>

      {error ? (
        <div className="text-center">
          <p className="text-brand-danger font-semibold mb-2">Invitacion invalida</p>
          <p className="text-brand-muted text-sm mb-6">{error}</p>
          <Link to="/groups" className="btn-secondary max-w-xs">Ir a grupos</Link>
        </div>
      ) : joined ? (
        <div className="text-center">
          <CheckCircle size={48} className="text-brand-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Listo</h2>
          <p className="text-brand-muted">Redirigiendo al grupo...</p>
        </div>
      ) : groupInfo ? (
        <div className="w-full">
          <p className="text-brand-muted text-sm text-center mb-2">Has sido invitado a unirte</p>
          <div className="card mb-6 text-center">
            <div className="w-12 h-12 bg-brand-elevated rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-brand-primary" />
            </div>
            <h2 className="text-xl font-bold">{groupInfo.name}</h2>
            <p className="text-brand-muted text-sm mt-1">
              {groupInfo.memberCount} miembro{groupInfo.memberCount !== 1 ? 's' : ''} · 
              Creado por @{groupInfo.creator?.nickname}
            </p>
          </div>

          {user ? (
            <button onClick={handleJoin} className="btn-primary" disabled={joining}>
              {joining ? 'Uniendote...' : 'Unirme al grupo'}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <Link to={`/register?inviteCode=${inviteCode}`} className="btn-primary">
                Crear cuenta y unirme
              </Link>
              <Link to={`/login`} state={{ from: { pathname: `/join/${inviteCode}` } }} className="btn-secondary">
                Iniciar sesion y unirme
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
