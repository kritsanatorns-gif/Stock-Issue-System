import { Navigate } from 'react-router-dom'
import { getAllowedNavigationItems } from '../../app/navigationItems'
import { useAuthStore } from '../../store/authStore'

function NavigateToFirstAllowed() {
  const employee = useAuthStore((state) => state.employee)
  const firstAllowedPath = getAllowedNavigationItems(employee)[0]?.path

  return <Navigate to={firstAllowedPath ?? '/login'} replace />
}

export default NavigateToFirstAllowed
