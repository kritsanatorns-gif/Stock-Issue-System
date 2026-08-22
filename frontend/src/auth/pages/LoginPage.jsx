import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginPanel from '../../components/LoginPanel'
import { useAuthStore } from '../../store/authStore'
import { useRequestAuthStore } from '../../store/requestAuthStore'
import '../../components/LoginPanel.css'

function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const expiresAt = useAuthStore((state) => state.expiresAt)
  const isRequestAuthenticated = useRequestAuthStore((state) => state.isAuthenticated)
  const requestExpiresAt = useRequestAuthStore((state) => state.expiresAt)
  const location = useLocation()
  const navigate = useNavigate()
  const requestLogout = useRequestAuthStore((state) => state.logout)
  const from = location.state?.from?.pathname || '/dashboard'
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()
  const isRequestSessionActive = isRequestAuthenticated && requestExpiresAt && requestExpiresAt > Date.now()

  if (isRequestSessionActive) {
    return <Navigate to="/request" replace />
  }

  if (isSessionActive) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="login-page">
      <LoginPanel onSuccess={() => {
        requestLogout()
        navigate(from, { replace: true })
      }} />
    </div>
  )
}

export default LoginPage
