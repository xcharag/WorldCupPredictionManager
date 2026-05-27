import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wc_token')
      // Don't auto-redirect during OAuth callback flow - let the component handle it
      if (!window.location.pathname.includes('/auth/callback')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
