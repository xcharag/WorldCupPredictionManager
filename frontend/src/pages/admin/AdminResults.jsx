import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import PageHeader from '../../components/PageHeader'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast, ToastContainer } from '../../components/Toast'
import { Check } from 'lucide-react'

export default function AdminResults() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [resultForms, setResultForms] = useState({}) // matchId -> { homeScore, awayScore }
  const [saving, setSaving] = useState({})
  const [tournamentForm, setTournamentForm] = useState({
    champion: '', runnerUp: '', topScorer: '', topAssister: '',
    mostYellowCards: '', mostRedCards: '',
  })
  const [savingTournament, setSavingTournament] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    Promise.all([
      api.get('/admin/matches'),
      api.get('/admin/teams'),
      api.get('/admin/players'),
      api.get('/admin/settings'),
    ]).then(([m, t, p, s]) => {
      setMatches(m.data)
      setTeams(t.data)
      setPlayers(p.data)
      if (s.data.tournamentResults) {
        const r = s.data.tournamentResults
        setTournamentForm({
          champion: r.champion || '',
          runnerUp: r.runnerUp || '',
          topScorer: r.topScorer || '',
          topAssister: r.topAssister || '',
          mostYellowCards: r.mostYellowCards || '',
          mostRedCards: r.mostRedCards || '',
        })
      }
    }).finally(() => setLoading(false))
  }, [])

  const setResult = (matchId, k, v) => {
    setResultForms(f => ({ ...f, [matchId]: { ...(f[matchId] || {}), [k]: v } }))
  }

  const saveResult = async (match) => {
    const form = resultForms[match._id] || {}
    const homeScore = form.homeScore ?? match.homeScore
    const awayScore = form.awayScore ?? match.awayScore
    if (homeScore === undefined || homeScore === '' || awayScore === undefined || awayScore === '') {
      addToast('Ingresa ambos marcadores', 'error'); return
    }
    setSaving(s => ({ ...s, [match._id]: true }))
    try {
      const { data } = await api.put(`/admin/matches/${match._id}/result`, {
        homeScore: Number(homeScore), awayScore: Number(awayScore), status: 'finished',
      })
      setMatches(m => m.map(x => x._id === match._id ? data : x))
      addToast('Resultado guardado y puntos actualizados', 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error', 'error')
    } finally {
      setSaving(s => ({ ...s, [match._id]: false }))
    }
  }

  const saveTournament = async (e) => {
    e.preventDefault()
    setSavingTournament(true)
    try {
      await api.put('/admin/tournament-results', tournamentForm)
      addToast('Resultados del torneo guardados', 'success')
    } catch { addToast('Error al guardar', 'error') }
    finally { setSavingTournament(false) }
  }

  const setTF = k => e => setTournamentForm(f => ({ ...f, [k]: e.target.value }))

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Resultados" onBack={() => navigate('/admin')} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-3 flex flex-col gap-4">
        {/* Match results */}
        {matches.map(match => {
          const rf = resultForms[match._id] || {}
          const homeVal = rf.homeScore !== undefined ? rf.homeScore : (match.homeScore ?? '')
          const awayVal = rf.awayScore !== undefined ? rf.awayScore : (match.awayScore ?? '')
          return (
            <div key={match._id} className="card">
              <p className="text-xs text-brand-muted mb-2 capitalize">{match.stage?.replace(/_/g,' ')}{match.group && ` · Group ${match.group}`}</p>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-right font-semibold text-sm">
                  {match.homeTeam?.flag} {match.homeTeam?.shortName || 'Por definir'}
                </span>
                <input type="number" min={0} max={99} className="score-input w-14 h-12 text-xl"
                  value={homeVal} onChange={e => setResult(match._id, 'homeScore', e.target.value)}
                  disabled={match.status === 'finished'} />
                <span className="text-brand-muted font-bold">–</span>
                <input type="number" min={0} max={99} className="score-input w-14 h-12 text-xl"
                  value={awayVal} onChange={e => setResult(match._id, 'awayScore', e.target.value)}
                  disabled={match.status === 'finished'} />
                <span className="flex-1 font-semibold text-sm">
                  {match.awayTeam?.flag} {match.awayTeam?.shortName || 'Por definir'}
                </span>
              </div>
              {match.status !== 'finished' && (
                <button onClick={() => saveResult(match)} disabled={saving[match._id]}
                  className="btn-primary mt-3 flex items-center justify-center gap-1">
                  <Check size={16} /> {saving[match._id] ? 'Guardando...' : 'Guardar resultado'}
                </button>
              )}
              {match.status === 'finished' && (
                <p className="text-center text-xs text-brand-primary mt-2">Resultado registrado</p>
              )}
            </div>
          )
        })}

        {/* Tournament results */}
        <div className="card border border-amber-500/20 mt-2">
          <h3 className="font-bold mb-3">Resultados finales del torneo</h3>
          <form onSubmit={saveTournament} className="flex flex-col gap-3">
            {[
              { key: 'champion', label: 'Campeon', type: 'team' },
              { key: 'runnerUp', label: 'Subcampeon', type: 'team' },
              { key: 'topScorer', label: 'Maximo goleador', type: 'player' },
              { key: 'topAssister', label: 'Maximo asistidor', type: 'player' },
              { key: 'mostYellowCards', label: 'Mas tarjetas amarillas', type: 'player' },
              { key: 'mostRedCards', label: 'Mas tarjetas rojas', type: 'player' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <SearchableSelect
                  value={tournamentForm[key]}
                  onChange={(nextValue) => setTF(key)({ target: { value: nextValue } })}
                  placeholder="Seleccionar"
                  searchPlaceholder={type === 'team' ? 'Buscar pais...' : 'Buscar jugador...'}
                  options={
                    [{ value: '', label: 'Sin definir' }].concat(
                      type === 'team'
                        ? teams.map(t => ({ value: t._id, label: `${t.flag} ${t.name}` }))
                        : players.map(p => ({ value: p._id, label: `${p.name} (${p.team?.shortName || '?'})` }))
                    )
                  }
                />
              </div>
            ))}
            <button type="submit" className="btn-primary" disabled={savingTournament}>
              {savingTournament ? 'Guardando...' : 'Guardar resultados del torneo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
