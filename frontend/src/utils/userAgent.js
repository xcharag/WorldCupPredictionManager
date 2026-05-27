/**
 * Detect if the user is in an embedded browser (webview)
 * These browsers are often blocked by Google OAuth
 */
export function isEmbeddedBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  // Instagram in-app browser
  if (ua.includes('Instagram')) return true
  
  // Facebook in-app browser
  if (ua.includes('FBAN') || ua.includes('FBAV')) return true
  
  // TikTok in-app browser
  if (ua.includes('musical_ly') || ua.includes('BytedanceWebview')) return true
  
  // Twitter in-app browser
  if (ua.includes('Twitter')) return true
  
  // LinkedIn in-app browser
  if (ua.includes('LinkedInApp')) return true
  
  // Snapchat in-app browser
  if (ua.includes('Snapchat')) return true
  
  // WeChat in-app browser
  if (ua.includes('MicroMessenger')) return true
  
  // Line in-app browser
  if (ua.includes('Line/')) return true
  
  return false
}

/**
 * Get the name of the embedded browser
 */
export function getEmbeddedBrowserName() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  if (ua.includes('Instagram')) return 'Instagram'
  if (ua.includes('FBAN') || ua.includes('FBAV')) return 'Facebook'
  if (ua.includes('musical_ly') || ua.includes('BytedanceWebview')) return 'TikTok'
  if (ua.includes('Twitter')) return 'Twitter'
  if (ua.includes('LinkedInApp')) return 'LinkedIn'
  if (ua.includes('Snapchat')) return 'Snapchat'
  if (ua.includes('MicroMessenger')) return 'WeChat'
  if (ua.includes('Line/')) return 'Line'
  
  return 'in-app browser'
}

/**
 * Get instructions for opening in default browser
 */
export function getOpenInBrowserInstructions() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  if (ua.includes('Instagram')) {
    return 'Tocá el menú (⋯) en la esquina superior derecha y seleccioná "Abrir en navegador"'
  }
  
  if (ua.includes('FBAN') || ua.includes('FBAV')) {
    return 'Tocá el menú (⋯) y seleccioná "Abrir en Chrome" o "Abrir en Safari"'
  }
  
  if (ua.includes('musical_ly') || ua.includes('BytedanceWebview')) {
    return 'Tocá el menú (⋯) y seleccioná "Abrir en navegador"'
  }
  
  return 'Tocá el menú (⋯) y seleccioná "Abrir en navegador" o copia la URL y pégala en Chrome/Safari'
}

/**
 * Try to open the current URL in the default browser
 */
export function openInDefaultBrowser() {
  const url = window.location.href
  
  // For iOS, try to use the universal link approach
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    // Try Safari
    window.location.href = `x-safari-${url}`
    
    // Fallback: copy URL and show instructions
    setTimeout(() => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          alert('URL copiada! Pégala en Safari para continuar.')
        }).catch(() => {
          alert('Por favor copia esta URL y ábrela en Safari:\n' + url)
        })
      }
    }, 500)
  } else {
    // Android or other - try intent
    window.location.href = `intent:${url.replace(/^https?:\/\//, '')}#Intent;end`
    
    // Fallback
    setTimeout(() => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          alert('URL copiada! Pégala en Chrome para continuar.')
        }).catch(() => {
          alert('Por favor copia esta URL y ábrela en Chrome:\n' + url)
        })
      }
    }, 500)
  }
}
