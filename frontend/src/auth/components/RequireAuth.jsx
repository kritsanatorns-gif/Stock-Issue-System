import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useRequestAuthStore } from '../../store/requestAuthStore'

function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const expiresAt = useAuthStore((state) => state.expiresAt)
  const logout = useAuthStore((state) => state.logout)
  const isRequestAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const requestExpiresAt = useRequestAuthStore((state) => state.expiresAt)
  const location = useLocation()
  const isExpired = isAuthenticated && expiresAt && expiresAt <= Date.now()
  const isRequestSessionActive = isRequestAuthenticated && requestExpiresAt && requestExpiresAt > Date.now()

  useEffect(() => {
    if (!isAuthenticated || !expiresAt) {
      return undefined
    }

    const remainingTime = expiresAt - Date.now()

    if (remainingTime <= 0) {
      logout()

      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      logout()
    }, remainingTime)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [expiresAt, isAuthenticated, logout])

  if (isRequestSessionActive) {
    return <Navigate to="/request" replace />
  }

  if (!isAuthenticated || isExpired) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default RequireAuth
