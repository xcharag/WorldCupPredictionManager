import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Tab order — used to decide slide direction (left vs right)
const TAB_ORDER = ['/', '/groups', '/matches', '/tournament', '/leaderboard', '/profile', '/admin']

function getTabIndex(pathname) {
  // Exact match first
  const exact = TAB_ORDER.indexOf(pathname)
  if (exact !== -1) return exact
  // Prefix match (e.g. /groups/abc → /groups)
  for (let i = TAB_ORDER.length - 1; i >= 0; i--) {
    if (TAB_ORDER[i] !== '/' && pathname.startsWith(TAB_ORDER[i])) return i
  }
  return -1
}

export default function PageTransition({ children }) {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prev = prevPathRef.current
    const curr = location.pathname

    if (prev === curr) return

    const prevIdx = getTabIndex(prev)
    const currIdx = getTabIndex(curr)

    let animClass = 'page-enter' // default: slide from right

    if (prevIdx !== -1 && currIdx !== -1) {
      animClass = currIdx < prevIdx ? 'page-enter-back' : 'page-enter'
    }

    // Remove previous animation class, force reflow, add new one
    container.classList.remove('page-enter', 'page-enter-back')
    void container.offsetWidth // reflow
    container.classList.add(animClass)

    prevPathRef.current = curr

    const onEnd = () => container.classList.remove(animClass)
    container.addEventListener('animationend', onEnd, { once: true })
    return () => container.removeEventListener('animationend', onEnd)
  }, [location.pathname])

  return (
    <div ref={containerRef} style={{ willChange: 'transform, opacity' }}>
      {children}
    </div>
  )
}
