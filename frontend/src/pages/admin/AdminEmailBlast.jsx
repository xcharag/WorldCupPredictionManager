import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Send } from 'lucide-react'
import api from '../../services/api'
import PageHeader from '../../components/PageHeader'
import { useToast, ToastContainer } from '../../components/Toast'

export default function AdminEmailBlast() {
  const navigate = useNavigate()
  const { toasts, addToast, removeToast } = useToast()
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [recipientType, setRecipientType] = useState('verified')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const handleSend = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      addToast('Completá el asunto y el cuerpo del mensaje', 'error')
      return
    }
    if (!confirm(`¿Enviar este email a todos los usuarios ${recipientType === 'all' ? 'registrados' : 'verificados'}?`)) return
    setSending(true)
    setResult(null)
    try {
      const { data } = await api.post('/admin/email-blast', { subject, htmlBody, recipientType })
      setResult(data)
      addToast(`Enviado a ${data.sent} usuarios${data.failed ? ` (${data.failed} fallaron)` : ''}`, data.failed ? 'warning' : 'success')
    } catch (err) {
      addToast(err.response?.data?.message || 'Error al enviar', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page max-w-md mx-auto">
      <PageHeader title="Email masivo" onBack={() => navigate('/admin')} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Recipient type */}
        <div className="card">
          <p className="text-xs text-brand-muted mb-2">Destinatarios</p>
          <div className="flex gap-2">
            {[
              { value: 'verified', label: 'Solo verificados' },
              { value: 'all', label: 'Todos los registrados' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setRecipientType(opt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  recipientType === opt.value
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-elevated text-brand-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="card flex flex-col gap-2">
          <label className="text-xs text-brand-muted">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Ej: Novedades del Mundial 2026"
            className="input text-sm"
            maxLength={200}
          />
        </div>

        {/* Body */}
        <div className="card flex flex-col gap-2">
          <label className="text-xs text-brand-muted">
            Cuerpo del email <span className="text-brand-muted/60">(HTML permitido)</span>
          </label>
          <textarea
            value={htmlBody}
            onChange={e => setHtmlBody(e.target.value)}
            placeholder={'<p>Hola,</p>\n<p>Te escribimos para informarte...</p>'}
            className="input text-sm font-mono resize-y"
            rows={10}
          />
        </div>

        {/* Preview */}
        {htmlBody.trim() && (
          <div className="card">
            <p className="text-xs text-brand-muted mb-2">Vista previa</p>
            <div
              className="text-sm rounded-lg bg-brand-elevated p-3 overflow-auto max-h-64"
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="card bg-brand-primary/10 border border-brand-primary/30">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={16} className="text-brand-primary" />
              <p className="font-semibold text-sm">Resultado del envío</p>
            </div>
            <p className="text-sm text-brand-muted">Total: {result.total} · Enviados: {result.sent} · Fallidos: {result.failed}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !subject.trim() || !htmlBody.trim()}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {sending ? 'Enviando...' : 'Enviar email masivo'}
        </button>
      </div>
    </div>
  )
}
