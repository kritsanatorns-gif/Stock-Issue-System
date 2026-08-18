import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginPanel from '../../components/LoginPanel'
import { useAuthStore } from '../../store/authStore'
import '../../components/LoginPanel.css'

function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const expiresAt = useAuthStore((state) => state.expiresAt)
  const location = useLocation()
  const navigate = useNavigate()
  const from = location.state?.from?.pathname || '/dashboard'
  const isSessionActive = isAuthenticated && expiresAt && expiresAt > Date.now()

  if (isSessionActive) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="login-page">
      <LoginPanel onSuccess={() => navigate(from, { replace: true })} />
    </div>
  )
}

export default LoginPage
