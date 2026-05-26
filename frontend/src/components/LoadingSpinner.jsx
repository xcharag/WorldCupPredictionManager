export default function LoadingSpinner({ fullScreen = false, size = 'md' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
  const spinner = (
    <div className={`${sizes[size]} border-3 border-brand-border border-t-brand-primary rounded-full animate-spin`}
         style={{ borderWidth: '3px' }} />
  )
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-brand-bg flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }
  return <div className="flex items-center justify-center py-8">{spinner}</div>
}
