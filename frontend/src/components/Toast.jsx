import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

export function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const config = {
    success: { icon: CheckCircle, cls: 'bg-green-900/90 border-green-700 text-green-200' },
    error: { icon: XCircle, cls: 'bg-red-900/90 border-red-700 text-red-200' },
    info: { icon: AlertCircle, cls: 'bg-brand-elevated border-brand-border text-brand-text' },
  }
  const { icon: Icon, cls } = config[type] || config.info

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cls} shadow-xl`}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onClose}><X size={16} /></button>
    </div>
  )
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col gap-2 px-4 max-w-md mx-auto pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  )
}

let toastId = 0
export function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = (message, type = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
  }
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))
  return { toasts, addToast, removeToast, toast: addToast }
}
