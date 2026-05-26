import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Escribe para buscar...',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, term])

  const pick = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
    setTerm('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-brand-text truncate' : 'text-brand-muted truncate'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-brand-muted ml-2 flex-shrink-0" />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-brand-surface border border-brand-border rounded-xl shadow-xl">
          <div className="p-2 border-b border-brand-border">
            <div className="flex items-center gap-2 bg-brand-elevated rounded-lg px-2 py-1.5">
              <Search size={14} className="text-brand-muted" />
              <input
                className="bg-transparent w-full text-sm outline-none"
                placeholder={searchPlaceholder}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="text-sm text-brand-muted px-2 py-2">Sin resultados</p>
            )}
            {filtered.map((opt) => (
              <button
                type="button"
                key={opt.value || '__empty__'}
                onClick={() => pick(opt.value)}
                className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-brand-elevated"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
