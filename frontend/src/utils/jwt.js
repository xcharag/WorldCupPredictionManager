/**
 * Decode a JWT token (without verification - for client-side debugging only)
 * @param {string} token - The JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
export function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = parts[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error)
    return null
  }
}

/**
 * Check if a JWT token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} True if expired, false otherwise
 */
export function isTokenExpired(token) {
  const decoded = decodeJWT(token)
  if (!decoded || !decoded.exp) return true
  
  const now = Math.floor(Date.now() / 1000)
  return decoded.exp < now
}

/**
 * Get token expiration info for debugging
 * @param {string} token - The JWT token
 * @returns {object} Token info including expiration date and time remaining
 */
export function getTokenInfo(token) {
  const decoded = decodeJWT(token)
  if (!decoded || !decoded.exp) {
    return { valid: false, expired: true }
  }
  
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = new Date(decoded.exp * 1000)
  const secondsRemaining = decoded.exp - now
  const daysRemaining = Math.floor(secondsRemaining / 86400)
  const hoursRemaining = Math.floor((secondsRemaining % 86400) / 3600)
  
  return {
    valid: true,
    expired: secondsRemaining <= 0,
    userId: decoded.userId,
    issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
    expiresAt,
    secondsRemaining: Math.max(0, secondsRemaining),
    daysRemaining: Math.max(0, daysRemaining),
    hoursRemaining: Math.max(0, hoursRemaining),
    timeRemaining: secondsRemaining > 0 
      ? `${daysRemaining}d ${hoursRemaining}h`
      : 'Expired'
  }
}

/**
 * Log token info to console for debugging
 * @param {string} token - The JWT token
 */
export function logTokenInfo(token) {
  const info = getTokenInfo(token)
  if (!info.valid) {
    console.log('[JWT] Invalid token format')
    return
  }
  
  console.log('[JWT] Token Info:', {
    userId: info.userId,
    expired: info.expired,
    expiresAt: info.expiresAt?.toLocaleString(),
    timeRemaining: info.timeRemaining,
    issuedAt: info.issuedAt?.toLocaleString()
  })
}
