import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, subtitle, onBack, action }) {
  const navigate = useNavigate()
  const handleBack = onBack || (() => navigate(-1))

  return (
    <div className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-sm border-b-2 border-brand-navy px-4 py-3">
      <div className="flex items-center gap-3 max-w-md mx-auto">
        <button onClick={handleBack} className="p-1 -ml-1 text-brand-muted active:text-brand-text">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg leading-none truncate">{title}</h1>
          {subtitle && <p className="text-xs text-brand-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
