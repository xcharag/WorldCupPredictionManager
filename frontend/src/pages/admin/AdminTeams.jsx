import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast, ToastContainer } from '../../components/Toast'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

const EMPTY = { name: '', shortName: '', flag: '🏳️', fifaCode: '', confederation: '', group: '' }
const CONFS = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']

export default function AdminTeams() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // team object or 'new'
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const load = () => api.get('/admin/teams').then(r => setTeams(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const startEdit = (team) => { setEditing(team._id); setForm({ ...EMPTY, ...team }) }
  const startNew = () => { setEditing('new'); setForm(EMPTY) }
  const cancel = () => { setEditing(null) }

  const save = async () => {
    setSaving(true)
    try {
      if (editing === 'new') {
        const { data } = await api.post('/admin/teams', form)
        setTeams(t => [...t, data])
      } else {
        const { data } = await api.put(`/admin/teams/${editing}`, form)
        setTeams(t => t.map(x => x._id === editing ? data : x))
      }
      setEditing(null)
      addToast('Equipo guardado', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    if (!confirm('Eliminar este equipo?')) return
    try {
      await api.delete(`/admin/teams/${id}`)
      setTeams(t => t.filter(x => x._id !== id))
      addToast('Eliminado', 'success')
    } catch {
      addToast('No se pudo eliminar', 'error')
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Equipos" onBack={() => navigate('/admin')} action={
        <button onClick={startNew} className="flex items-center gap-1 bg-brand-primary text-white text-sm font-semibold px-3 py-2 rounded-xl">
          <Plus size={15} /> Agregar
        </button>
      } />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-3 flex flex-col gap-3">
        {editing === 'new' && <TeamForm form={form} set={set} saving={saving} onSave={save} onCancel={cancel} />}

        {teams.map(team => (
          editing === team._id ? (
            <TeamForm key={team._id} form={form} set={set} saving={saving} onSave={save} onCancel={cancel} />
          ) : (
            <div key={team._id} className="card flex items-center gap-3">
              <span className="text-2xl">{team.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{team.name}</p>
                <p className="text-xs text-brand-muted">{team.shortName} · {team.confederation} {team.group && `· Grupo ${team.group}`}</p>
              </div>
              <button onClick={() => startEdit(team)} className="p-2 text-brand-muted active:text-brand-text">
                <Pencil size={16} />
              </button>
              <button onClick={() => del(team._id)} className="p-2 text-brand-danger active:opacity-70">
                <Trash2 size={16} />
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function TeamForm({ form, set, saving, onSave, onCancel }) {
  const confederationOptions = [{ value: '', label: 'Sin definir' }, ...CONFS.map(c => ({ value: c, label: c }))]

  return (
    <div className="card flex flex-col gap-2 border border-brand-primary/30">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={set('name')} placeholder="Brasil" /></div>
        <div><label className="label">Codigo *</label><input className="input" value={form.shortName} onChange={set('shortName')} placeholder="BRA" maxLength={3} /></div>
        <div><label className="label">Bandera</label><input className="input" value={form.flag} onChange={set('flag')} placeholder="🇧🇷" /></div>
        <div><label className="label">FIFA Code</label><input className="input" value={form.fifaCode} onChange={set('fifaCode')} placeholder="GER" /></div>
        <div>
          <label className="label">Confederacion</label>
          <SearchableSelect
            value={form.confederation}
            onChange={(nextValue) => set('confederation')({ target: { value: nextValue } })}
            options={confederationOptions}
            placeholder="Seleccionar"
            searchPlaceholder="Buscar confederacion..."
          />
        </div>
        <div><label className="label">Grupo</label><input className="input" value={form.group} onChange={set('group')} placeholder="A" maxLength={2} /></div>
      </div>
      <div className="flex gap-2 mt-1">
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
