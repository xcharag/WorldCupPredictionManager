import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerServiceWorker } from './utils/push'

// Capture PWA install prompt as early as possible, before React mounts.
// The beforeinstallprompt event fires very early and would otherwise be missed
// by the useEffect listener in Home.jsx.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
})

async function checkAndBustCache() {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return
    const { version } = await res.json()
    const stored = localStorage.getItem('app-deploy-version')
    if (stored && stored !== version) {
      localStorage.setItem('app-deploy-version', version)
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      window.location.reload()
      return
    }
    localStorage.setItem('app-deploy-version', version)
  } catch {
    // Network unavailable — skip so the app still works offline
  }
}

;(async () => {
  await checkAndBustCache()
  registerServiceWorker()
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})()
