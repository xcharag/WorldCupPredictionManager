// @refresh reset
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

const DARK_VARS = {
  '--brand-bg':           '6 8 15',
  '--brand-surface':      '12 21 37',
  '--brand-elevated':     '18 32 64',
  '--brand-border':       '26 46 85',
  '--brand-navy':         '8 28 89',
  '--brand-primary':      '25 193 114',
  '--brand-primary-dark': '14 89 62',
  '--brand-accent':       '227 21 21',
  '--brand-danger':       '227 21 21',
  '--brand-text':         '255 255 255',
  '--brand-muted':        '122 144 184',
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      Object.entries(DARK_VARS).forEach(([k, v]) => root.style.setProperty(k, v))
    } else {
      root.classList.remove('dark')
      Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k))
    }
    try { localStorage.setItem('theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
