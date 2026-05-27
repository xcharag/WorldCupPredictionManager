import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2, Archive } from 'lucide-react'
import api from '../../services/api'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)  return `hace ${Math.round(diff / 1000)}s`
  if (diff < 3600000) return `hace ${Math.round(diff / 60000)}min`
  if (diff < 86400000) return `hace ${Math.round(diff / 3600000)}h`
  return `hace ${Math.round(diff / 86400000)}d`
}

function timeUntil(iso) {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0)     return 'ahora'
  if (diff < 60000) return `en ${Math.round(diff / 1000)}s`
  if (diff < 3600000) return `en ${Math.round(diff / 60000)}min`
  return `en ${Math.round(diff / 3600000)}h`
}

function durationStr(ms) {
  if (ms == null) return '—'
  if (ms < 1000)  return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' })
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
      <Loader2 size={11} className="animate-spin" /> Corriendo
    </span>
  )
  if (status === 'success') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
      <CheckCircle2 size={11} /> OK
    </span>
  )
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
      <XCircle size={11} /> Error
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-elevated text-brand-muted text-xs font-semibold">
      <Clock size={11} /> Idle
    </span>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onSelectJob, isSelected }) {
  return (
    <button
      onClick={() => onSelectJob(isSelected ? null : job.name)}
      className={[
        'card w-full text-left transition-all',
        isSelected ? 'ring-2 ring-brand-primary' : 'active:bg-brand-elevated',
        job.status === 'error' ? 'border-red-500/40' : '',
        job.status === 'running' ? 'border-blue-500/40' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-sm">{job.name}</p>
          <p className="text-xs text-brand-muted mt-0.5">{job.description}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-brand-muted">Frecuencia</span>
          <p className="font-medium">{job.scheduleLabel}</p>
        </div>
        <div>
          <span className="text-brand-muted">Siguiente</span>
          <p className="font-medium">{timeUntil(job.nextRun)}</p>
        </div>
        <div>
          <span className="text-brand-muted">Último</span>
          <p className="font-medium">{timeAgo(job.lastRun?.startedAt)}</p>
        </div>
        <div>
          <span className="text-brand-muted">Ejecuciones</span>
          <p className="font-medium">{job.runCount}</p>
        </div>
      </div>

      {job.lastRun?.result && (
        <p className="mt-2 text-xs text-green-400 truncate">↳ {job.lastRun.result}</p>
      )}
      {job.lastRun?.error && (
        <p className="mt-2 text-xs text-red-400 truncate">⚠ {job.lastRun.error}</p>
      )}
    </button>
  )
}

// ── Log entry row ─────────────────────────────────────────────────────────────
function LogRow({ entry }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2 text-xs cursor-pointer select-none',
        entry.status === 'error'   ? 'border-red-500/30 bg-red-950/10'  : '',
        entry.status === 'success' ? 'border-brand-border bg-brand-card' : '',
        entry.status === 'running' ? 'border-blue-500/30 bg-blue-950/10' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={entry.status} />
        <span className="font-semibold text-brand-muted">{entry.job}</span>
        <span className="text-brand-muted">{fmtDate(entry.startedAt)}</span>
        <span className="ml-auto text-brand-muted">{durationStr(entry.durationMs)}</span>
      </div>

      {entry.result && (
        <p className="mt-1 text-green-400">↳ {entry.result}</p>
      )}
      {entry.error && (
        <p className="mt-1 text-red-400 break-all">⚠ {entry.error}</p>
      )}

      {open && (
        <pre className="mt-2 text-[10px] text-brand-muted whitespace-pre-wrap break-all bg-brand-bg rounded p-2">
          {JSON.stringify(entry, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCron() {
  const navigate = useNavigate()
  const [jobs, setJobs]         = useState([])
  const [logs, setLogs]         = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [source, setSource]     = useState('memory')
  const [loading, setLoading]   = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/cron/jobs')
      setJobs(data)
      setLastRefresh(new Date())
    } catch { /* ignore */ }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '80', source })
      if (selectedJob) params.set('job', selectedJob)
      const { data } = await api.get(`/admin/cron/logs?${params}`)
      setLogs(data)
    } catch { /* ignore */ }
    finally { setLogsLoading(false) }
  }, [selectedJob, source])

  // Initial load
  useEffect(() => {
    Promise.all([fetchJobs(), fetchLogs()]).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Reload logs when filter changes
  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-refresh jobs every 30s
  useEffect(() => {
    const t = setInterval(fetchJobs, 30000)
    return () => clearInterval(t)
  }, [fetchJobs])

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto pb-24">
      <PageHeader
        title="Cron Jobs"
        onBack={() => navigate('/admin')}
        action={
          <button
            onClick={() => { fetchJobs(); fetchLogs() }}
            className="p-2 rounded-xl bg-brand-elevated text-brand-muted active:bg-brand-border"
          >
            <RefreshCw size={18} />
          </button>
        }
      />

      {lastRefresh && (
        <p className="text-center text-[10px] text-brand-muted mb-2">
          Actualizado {timeAgo(lastRefresh.toISOString())}
        </p>
      )}

      {/* ── Job cards ── */}
      <div className="px-4 flex flex-col gap-3 mb-6">
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
          Tareas programadas
        </p>
        {jobs.length === 0 && (
          <p className="text-sm text-brand-muted text-center py-4">
            No hay tareas registradas (servidor no inició el scheduler)
          </p>
        )}
        {jobs.map(j => (
          <JobCard
            key={j.name}
            job={j}
            isSelected={selectedJob === j.name}
            onSelectJob={setSelectedJob}
          />
        ))}
      </div>

      {/* ── Log feed ── */}
      <div className="px-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
            {selectedJob ? `Logs · ${selectedJob}` : 'Logs recientes'}
          </p>
          <div className="flex items-center gap-2">
            {/* Source toggle */}
            <div className="flex rounded-lg bg-brand-elevated p-0.5 text-xs">
              <button
                onClick={() => setSource('memory')}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${source === 'memory' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted'}`}
              >
                RAM
              </button>
              <button
                onClick={() => setSource('minio')}
                className={`px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${source === 'minio' ? 'bg-brand-surface text-brand-text' : 'text-brand-muted'}`}
              >
                <Archive size={11} /> MinIO
              </button>
            </div>
            {selectedJob && (
              <button
                onClick={() => setSelectedJob(null)}
                className="text-xs text-brand-muted underline"
              >
                Todos
              </button>
            )}
          </div>
        </div>

        {logsLoading && (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-brand-muted" />
          </div>
        )}

        {!logsLoading && logs.length === 0 && (
          <p className="text-sm text-brand-muted text-center py-6">
            {source === 'minio'
              ? 'Sin logs en MinIO (aún no hay ejecuciones no-triviales)'
              : 'Sin logs en memoria (servidor recién iniciado)'}
          </p>
        )}

        {!logsLoading && logs.map((entry, i) => (
          <LogRow key={`${entry.job}-${entry.startedAt}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  )
}
