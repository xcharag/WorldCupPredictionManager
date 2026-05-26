import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast, ToastContainer } from '../../components/Toast'
import { Plus, Pencil, Trash2, Check, X, Download, Upload } from 'lucide-react'

const STAGES = ['group_stage','round_of_32','round_of_16','quarter_final','semi_final','third_place','final']
const STATUSES = ['scheduled', 'in_progress', 'finished']
const EMPTY_MATCH = { homeTeam: '', awayTeam: '', matchDate: '', stage: 'group_stage', group: '', venue: '', matchNumber: '' }

export default function AdminMatches() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_MATCH)
  const [saving, setSaving] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    Promise.all([api.get('/admin/matches'), api.get('/admin/teams')])
      .then(([m, t]) => { setMatches(m.data); setTeams(t.data) })
      .finally(() => setLoading(false))
  }, [])

  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const startEdit = (m) => {
    setEditing(m._id)
    setForm({ ...EMPTY_MATCH, ...m, homeTeam: m.homeTeam?._id || '', awayTeam: m.awayTeam?._id || '', matchDate: toLocalInput(m.matchDate) })
  }
  const startNew = () => { setEditing('new'); setForm(EMPTY_MATCH) }
  const cancel = () => setEditing(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, matchDate: form.matchDate ? new Date(form.matchDate).toISOString() : undefined }
      if (editing === 'new') {
        const { data } = await api.post('/admin/matches', payload)
        setMatches(m => [data, ...m])
      } else {
        const { data } = await api.put(`/admin/matches/${editing}`, payload)
        setMatches(m => m.map(x => x._id === editing ? data : x))
      }
      setEditing(null)
      addToast('Partido guardado', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    if (!confirm('Eliminar partido?')) return
    try {
      await api.delete(`/admin/matches/${id}`)
      setMatches(m => m.filter(x => x._id !== id))
    } catch { addToast('Error al eliminar', 'error') }
  }

  const refreshMatches = async () => {
    const { data } = await api.get('/admin/matches')
    setMatches(data)
  }

  const downloadFile = (blobData, filename, type = 'text/csv;charset=utf-8;') => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type }))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const downloadTeamsCsv = async () => {
    try {
      const { data } = await api.get('/admin/teams/export-csv', { responseType: 'blob' })
      downloadFile(data, 'equipos_fifa_codes.csv')
    } catch {
      addToast('No se pudo descargar equipos', 'error')
    }
  }

  const downloadMatchesTemplate = async () => {
    try {
      const { data } = await api.get('/admin/matches/template-csv', { responseType: 'blob' })
      downloadFile(data, 'plantilla_partidos.csv')
    } catch {
      addToast('No se pudo descargar plantilla', 'error')
    }
  }

  const onBulkFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setBulkUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/admin/matches/bulk-csv', formData)
      await refreshMatches()
      addToast(`Importacion lista: ${data.created} creados, ${data.updated} actualizados, ${data.skipped} omitidos`, 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al importar partidos', 'error')
    } finally {
      setBulkUploading(false)
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Partidos" onBack={() => navigate('/admin')} action={
        <button onClick={startNew} className="flex items-center gap-1 bg-brand-primary text-white text-sm font-semibold px-3 py-2 rounded-xl">
          <Plus size={15} /> Agregar
        </button>
      } />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" onClick={downloadTeamsCsv} className="btn-secondary flex items-center justify-center gap-2">
            <Download size={16} /> Descargar equipos (fifaCode)
          </button>
          <button type="button" onClick={downloadMatchesTemplate} className="btn-secondary flex items-center justify-center gap-2">
            <Download size={16} /> Descargar plantilla partidos
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploading}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Upload size={16} /> {bulkUploading ? 'Subiendo...' : 'Subir partidos CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onBulkFileChange}
          />
        </div>

        {editing === 'new' && <MatchForm form={form} set={set} teams={teams} saving={saving} onSave={save} onCancel={cancel} />}

        {matches.map(m => (
          editing === m._id ? (
            <MatchForm key={m._id} form={form} set={set} teams={teams} saving={saving} onSave={save} onCancel={cancel} />
          ) : (
            <MatchRow key={m._id} match={m} onEdit={() => startEdit(m)} onDelete={() => del(m._id)} />
          )
        ))}
      </div>
    </div>
  )
}

function MatchRow({ match, onEdit, onDelete }) {
  const STATUS_CLS = { scheduled: 'badge-gray', in_progress: 'badge-green', finished: 'badge-amber' }
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className={`badge ${STATUS_CLS[match.status]}`}>{match.status === 'scheduled' ? 'programado' : match.status === 'in_progress' ? 'en juego' : 'finalizado'}</span>
        <span className="text-xs text-brand-muted capitalize">{match.stage?.replace(/_/g,' ')}</span>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-1.5 text-brand-muted"><Pencil size={15} /></button>
          <button onClick={onDelete} className="p-1.5 text-brand-danger"><Trash2 size={15} /></button>
        </div>
      </div>
      <p className="font-semibold">
        {match.homeTeam?.flag} {match.homeTeam?.shortName || 'Por definir'} vs {match.awayTeam?.flag} {match.awayTeam?.shortName || 'Por definir'}
        {match.status === 'finished' && ` — ${match.homeScore} : ${match.awayScore}`}
      </p>
      <p className="text-xs text-brand-muted mt-0.5">
        {match.matchDate ? new Date(match.matchDate).toLocaleString() : '—'} {match.venue && `· ${match.venue}`}
      </p>
    </div>
  )
}

function MatchForm({ form, set, teams, saving, onSave, onCancel }) {
  const teamOptions = [{ value: '', label: 'Por definir' }, ...teams.map(t => ({ value: t._id, label: `${t.flag} ${t.shortName} - ${t.name}` }))]
  const stageOptions = [
    { value: 'group_stage', label: 'Fase de grupos' },
    { value: 'round_of_32', label: 'Dieciseisavos' },
    { value: 'round_of_16', label: 'Octavos' },
    { value: 'quarter_final', label: 'Cuartos' },
    { value: 'semi_final', label: 'Semifinal' },
    { value: 'third_place', label: 'Tercer puesto' },
    { value: 'final', label: 'Final' },
  ]

  return (
    <div className="card flex flex-col gap-2 border border-brand-primary/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Equipo local</label>
          <SearchableSelect
            value={form.homeTeam}
            onChange={(nextValue) => set('homeTeam')({ target: { value: nextValue } })}
            options={teamOptions}
            placeholder="Seleccionar local"
            searchPlaceholder="Buscar pais..."
          />
        </div>
        <div>
          <label className="label">Equipo visitante</label>
          <SearchableSelect
            value={form.awayTeam}
            onChange={(nextValue) => set('awayTeam')({ target: { value: nextValue } })}
            options={teamOptions}
            placeholder="Seleccionar visitante"
            searchPlaceholder="Buscar pais..."
          />
        </div>
        <div className="col-span-2">
          <label className="label">Fecha y hora *</label>
          <input className="input" type="datetime-local" value={form.matchDate} onChange={set('matchDate')} required />
        </div>
        <div>
          <label className="label">Fase *</label>
          <SearchableSelect
            value={form.stage}
            onChange={(nextValue) => set('stage')({ target: { value: nextValue } })}
            options={stageOptions}
            placeholder="Seleccionar fase"
            searchPlaceholder="Buscar fase..."
          />
        </div>
        <div>
          <label className="label">Grupo</label>
          <input className="input" value={form.group} onChange={set('group')} placeholder="A" maxLength={2} />
        </div>
        <div>
          <label className="label">Partido #</label>
          <input className="input" type="number" value={form.matchNumber} onChange={set('matchNumber')} />
        </div>
        <div>
          <label className="label">Estadio</label>
          <input className="input" value={form.venue} onChange={set('venue')} placeholder="Estadio" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="btn-primary flex items-center justify-center gap-1">
          <Check size={16} /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center justify-center gap-1">
          <X size={16} /> Cancelar
        </button>
      </div>
    </div>
  )
}
