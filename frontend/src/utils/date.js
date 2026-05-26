// Tiny date utility to avoid adding a heavy dependency
export function format(date, pattern = 'MMM d') {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

export function formatDateTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d)) return ''
  return d.toLocaleString('es-ES', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
