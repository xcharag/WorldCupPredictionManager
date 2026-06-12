import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Users, RefreshCw, TrendingUp, Globe, Bell, Mail, Trophy, UserCheck } from 'lucide-react'
import api from '../../services/api'
import PageHeader from '../../components/PageHeader'

function Bone({ className = '' }) {
  return <div className={`rounded-lg bg-brand-elevated animate-pulse ${className}`} />
}

function StatCard({ label, value, sub, icon: Icon, iconClass = 'text-brand-primary' }) {
  return (
    <div className="card flex flex-col gap-1 py-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className={iconClass} />}
        <span className="text-xs text-brand-muted">{label}</span>
      </div>
      <p className="text-2xl font-extrabold leading-none">{value ?? '—'}</p>
      {sub && <p className="text-xs text-brand-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, icon: Icon, iconClass, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        <Icon size={16} className={iconClass} />
        <h2 className="font-bold text-sm">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function WeeklyBars({ weeks }) {
  if (!weeks?.length) return <p className="text-xs text-brand-muted">Sin datos suficientes</p>
  const max = Math.max(...weeks.map((w) => w.count), 1)
  return (
    <div className="space-y-1.5">
      {weeks.map((w) => (
        <div key={`${w._id.year}-${w._id.week}`} className="flex items-center gap-2">
          <span className="text-xs text-brand-muted w-14 flex-shrink-0">S{w._id.week}</span>
          <div className="flex-1 h-5 bg-brand-elevated rounded overflow-hidden">
            <div
              className="h-full bg-brand-primary/70 rounded transition-all duration-500"
              style={{ width: `${Math.round((w.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold w-5 text-right">{w.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminStats() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async (bust = false) => {
    try {
      // Adding _t param on bust bypasses any browser HTTP cache
      const { data: res } = await api.get(bust ? `/admin/stats?_t=${Date.now()}` : '/admin/stats')
      setData(res)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar estadísticas')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchStats().finally(() => setLoading(false))
  }, [fetchStats])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStats(true)
    setRefreshing(false)
  }

  const cachedLabel = data?.fromCache && data?.cachedAt
    ? `Caché · actualizado ${new Date(data.cachedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="page max-w-md mx-auto pb-24">
      <PageHeader
        title="Estadísticas"
        onBack={() => navigate('/admin')}
        action={
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 rounded-full hover:bg-brand-elevated transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-5">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {cachedLabel && (
          <p className="text-xs text-brand-muted text-center">{cachedLabel}</p>
        )}

        {loading ? (
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Bone className="h-4 w-32" />
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((j) => <Bone key={j} className="h-24" />)}
                </div>
              </div>
            ))}
          </div>
        ) : data ? (
          <>
            {/* ── Usuarios ─────────────────────────────────── */}
            <Section title="Usuarios" icon={Users} iconClass="text-brand-primary">
              <StatCard label="Registrados" value={data.users.total} icon={Users} />
              <StatCard
                label="Email verificado"
                value={data.users.verified}
                sub={`${data.users.verifiedPct}% del total`}
                icon={UserCheck}
                iconClass="text-emerald-400"
              />
              <StatCard
                label="Google OAuth"
                value={data.users.google}
                sub={`${data.users.local} con contraseña`}
                icon={Globe}
                iconClass="text-blue-400"
              />
              <StatCard
                label="Push activado"
                value={data.users.pushEnabled}
                icon={Bell}
                iconClass="text-amber-400"
              />
              <StatCard
                label="Activos (7 días)"
                value={data.users.activeLastWeek}
                icon={TrendingUp}
                iconClass="text-brand-accent"
              />
              <StatCard
                label="Activos (30 días)"
                value={data.users.activeLastMonth}
                icon={TrendingUp}
                iconClass="text-purple-400"
              />
            </Section>

            {/* ── Registro semanal ─────────────────────────── */}
            {data.users.registrationsByWeek?.length > 0 && (
              <div className="card space-y-3">
                <p className="text-sm font-semibold">Registros por semana (últimas 8 sem.)</p>
                <WeeklyBars weeks={data.users.registrationsByWeek} />
              </div>
            )}

            {/* ── Engagement ───────────────────────────────── */}
            <Section title="Engagement" icon={BarChart3} iconClass="text-brand-primary">
              <StatCard
                label="Predicciones de partidos"
                value={data.engagement.totalMatchPredictions}
                sub={`${data.engagement.uniqueMatchPredictors} usuarios únicos`}
                icon={BarChart3}
              />
              <StatCard
                label="Predicciones del torneo"
                value={data.engagement.totalTournamentPredictions}
                sub={`${data.engagement.uniqueTournamentPredictors} usuarios únicos`}
                icon={Trophy}
                iconClass="text-brand-accent"
              />
            </Section>

            {/* ── Campeón más elegido ──────────────────────── */}
            {data.engagement.topChampions?.length > 0 && (
              <div className="card space-y-3">
                <p className="text-sm font-semibold">Campeón más pronosticado</p>
                {(() => {
                  const maxVotes = data.engagement.topChampions[0].count
                  return data.engagement.topChampions.map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-base w-6 flex-shrink-0">{c.flag}</span>
                      <div className="flex-1 h-5 bg-brand-elevated rounded overflow-hidden">
                        <div
                          className="h-full bg-brand-primary/60 rounded transition-all duration-500"
                          style={{ width: `${Math.round((c.count / maxVotes) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-brand-muted w-16 text-right truncate">{c.name}</span>
                      <span className="text-xs font-semibold w-5 text-right">{c.count}</span>
                    </div>
                  ))
                })()}
              </div>
            )}

            {/* ── Plataforma ────────────────────────────────── */}
            <Section title="Plataforma" icon={Globe} iconClass="text-blue-400">
              <StatCard
                label="Grupos creados"
                value={data.platform.totalGroups}
                icon={Users}
                iconClass="text-blue-400"
              />
              <StatCard
                label="Promedio de miembros"
                value={data.platform.avgGroupSize}
                sub={`Máx. ${data.platform.maxGroupSize} miembros`}
                icon={Users}
                iconClass="text-purple-400"
              />
              <StatCard
                label="Emails de recordatorio"
                value={data.platform.totalRemindersSent}
                icon={Mail}
                iconClass="text-emerald-400"
              />
            </Section>
          </>
        ) : null}
      </div>
    </div>
  )
}
