import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast, ToastContainer } from '../../components/Toast'
import { Plus, Pencil, Trash2, Check, X, Download, Upload } from 'lucide-react'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const EMPTY = { name: '', team: '', position: 'FWD', number: '' }

export default function AdminRosters() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [bulkUploading, setBulkUploading] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    Promise.all([api.get('/admin/teams'), api.get('/admin/players')])
      .then(([t, p]) => { setTeams(t.data); setPlayers(p.data) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = selectedTeam ? players.filter(p => (p.team?._id || p.team) === selectedTeam) : players
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const startEdit = (p) => { setEditing(p._id); setForm({ ...EMPTY, ...p, team: p.team?._id || p.team }) }
  const startNew = () => { setEditing('new'); setForm({ ...EMPTY, team: selectedTeam }) }
  const cancel = () => setEditing(null)

  const save = async () => {
    setSaving(true)
    try {
      if (editing === 'new') {
        const { data } = await api.post('/admin/players', form)
        setPlayers(p => [...p, data])
      } else {
        const { data } = await api.put(`/admin/players/${editing}`, form)
        setPlayers(p => p.map(x => x._id === editing ? data : x))
      }
      setEditing(null)
      addToast('Jugador guardado', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    if (!confirm('Eliminar jugador?')) return
    try {
      await api.delete(`/admin/players/${id}`)
      setPlayers(p => p.filter(x => x._id !== id))
    } catch { addToast('Error al eliminar', 'error') }
  }

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/admin/players/template-csv', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'plantilla_jugadores.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      addToast('No se pudo descargar la plantilla', 'error')
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
      const { data } = await api.post('/admin/players/bulk-csv', formData)
      const refreshed = await api.get('/admin/players')
      setPlayers(refreshed.data)
      addToast(`Importacion lista: ${data.created} creados, ${data.updated} actualizados, ${data.skipped} omitidos`, 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al importar plantilla', 'error')
    } finally {
      setBulkUploading(false)
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Plantillas" onBack={() => navigate('/admin')} action={
        <button onClick={startNew} className="flex items-center gap-1 bg-brand-primary text-white text-sm font-semibold px-3 py-2 rounded-xl">
          <Plus size={15} /> Agregar
        </button>
      } />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button type="button" onClick={downloadTemplate} className="btn-secondary flex items-center justify-center gap-2">
            <Download size={16} /> Descargar plantilla
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploading}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Upload size={16} /> {bulkUploading ? 'Subiendo...' : 'Subir plantilla'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onBulkFileChange}
          />
        </div>

        <SearchableSelect
          value={selectedTeam}
          onChange={setSelectedTeam}
          options={[{ value: '', label: 'Todos los equipos' }, ...teams.map(t => ({ value: t._id, label: `${t.flag} ${t.name}` }))]}
          placeholder="Filtrar por equipo"
          searchPlaceholder="Buscar pais..."
        />

        <div className="flex flex-col gap-2">
          {editing === 'new' && <PlayerForm form={form} set={set} teams={teams} saving={saving} onSave={save} onCancel={cancel} />}

          {filtered.map(p => (
            editing === p._id ? (
              <PlayerForm key={p._id} form={form} set={set} teams={teams} saving={saving} onSave={save} onCancel={cancel} />
            ) : (
              <div key={p._id} className="card flex items-center gap-3">
                <span className={`badge text-xs font-bold px-2 py-0.5 rounded-md ${
                  p.position === 'GK' ? 'bg-yellow-900/50 text-yellow-400' :
                  p.position === 'DEF' ? 'bg-blue-900/50 text-blue-400' :
                  p.position === 'MID' ? 'bg-green-900/50 text-green-400' :
                  'bg-red-900/50 text-red-400'
                }`}>{p.position}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-brand-muted">{p.team?.flag} {p.team?.shortName} {p.number && `#${p.number}`}</p>
                </div>
                <button onClick={() => startEdit(p)} className="p-1.5 text-brand-muted"><Pencil size={14} /></button>
                <button onClick={() => del(p._id)} className="p-1.5 text-brand-danger"><Trash2 size={14} /></button>
              </div>
            )
          ))}
          {filtered.length === 0 && <p className="text-brand-muted text-sm text-center py-8">No se encontraron jugadores</p>}
        </div>
      </div>
    </div>
  )
}

function PlayerForm({ form, set, teams, saving, onSave, onCancel }) {
  const teamOptions = [{ value: '', label: 'Seleccionar' }, ...teams.map(t => ({ value: t._id, label: `${t.flag} ${t.shortName}` }))]
  const positionOptions = [
    { value: 'GK', label: 'Portero (GK)' },
    { value: 'DEF', label: 'Defensa (DEF)' },
    { value: 'MID', label: 'Mediocampo (MID)' },
    { value: 'FWD', label: 'Delantero (FWD)' },
  ]

  return (
    <div className="card flex flex-col gap-2 border border-brand-primary/30">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label className="label">Nombre *</label><input className="input" value={form.name} onChange={set('name')} placeholder="Nombre del jugador" /></div>
        <div>
          <label className="label">Equipo *</label>
          <SearchableSelect
            value={form.team}
            onChange={(nextValue) => set('team')({ target: { value: nextValue } })}
            options={teamOptions}
            placeholder="Seleccionar equipo"
            searchPlaceholder="Buscar pais..."
          />
        </div>
        <div>
          <label className="label">Posicion *</label>
          <SearchableSelect
            value={form.position}
            onChange={(nextValue) => set('position')({ target: { value: nextValue } })}
            options={positionOptions}
            placeholder="Seleccionar posicion"
            searchPlaceholder="Buscar posicion..."
          />
        </div>
        <div><label className="label">Numero</label><input className="input" type="number" value={form.number} onChange={set('number')} min={1} max={99} /></div>
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
