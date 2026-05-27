import { useEffect, useState } from 'react'
import api from '../services/api'

const MINIO_ENDPOINT = import.meta.env.VITE_MINIO_ENDPOINT || ''

// Module-level cache: stored URL → { signedUrl, expiresAt }
const signedUrlCache = new Map()

function isMinioUrl(src) {
  return Boolean(MINIO_ENDPOINT && src && src.startsWith(MINIO_ENDPOINT))
}

/**
 * Drop-in replacement for <img> that transparently handles Minio private-bucket URLs.
 * Non-Minio URLs (e.g. TheSportsDB CDN) are passed through unchanged.
 * Signed URLs are cached for 55 min (they expire after 1 h on the server).
 */
export default function MinioImage({ src, alt = '', className = '', fallback = null, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    // Return immediately from cache if available
    if (!src || !isMinioUrl(src)) return src || null
    const cached = signedUrlCache.get(src)
    if (cached && Date.now() < cached.expiresAt) return cached.signedUrl
    return null
  })
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!src) { setResolvedSrc(null); return }
    setImgError(false)

    if (!isMinioUrl(src)) {
      setResolvedSrc(src)
      return
    }

    // Check cache
    const cached = signedUrlCache.get(src)
    if (cached && Date.now() < cached.expiresAt) {
      setResolvedSrc(cached.signedUrl)
      return
    }

    let cancelled = false
    api.get('/images/signed', { params: { url: src } })
      .then(({ data }) => {
        if (cancelled) return
        signedUrlCache.set(src, {
          signedUrl: data.url,
          expiresAt: Date.now() + 55 * 60 * 1000, // cache 55 min
        })
        setResolvedSrc(data.url)
      })
      .catch(() => {
        if (!cancelled) setImgError(true)
      })

    return () => { cancelled = true }
  }, [src])

  if (imgError || !resolvedSrc) return fallback ?? null

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
      {...props}
    />
  )
}
