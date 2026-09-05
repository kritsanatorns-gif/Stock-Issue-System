import { Navigate, createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import MainLayout from '../layouts/MainLayout'
import LoginLayout from '../layouts/LoginLayout'
import NavigateToFirstAllowed from '../auth/components/NavigateToFirstAllowed'
import RequireAuth from '../auth/components/RequireAuth'
import RequireMenuAccess from '../auth/components/RequireMenuAccess'
import RequestLayout from '../request/layouts/RequestLayout'

const LoginPage = lazy(() => import('../auth/pages/LoginPage'))
const ApprovalsPage = lazy(() => import('../approvals/pages/ApprovalsPage'))
const DashboardPage = lazy(() => import('../Dashboard/pages/DashboardPage'))
const DepartmentsPage = lazy(() => import('../departments/pages/DepartmentsPage'))
const ProductsPage = lazy(() => import('../products/pages/ProductsPage'))
const ReportsPage = lazy(() => import('../reports/pages/ReportsPage'))
const StockAdjustPage = lazy(() => import('../stockAdjust/pages/StockAdjustPage'))
const StockInPage = lazy(() => import('../stockIn/pages/StockInPage'))
const StockIssuePage = lazy(() => import('../stockIssue/pages/StockOutPage'))
const SuppliersPage = lazy(() => import('../suppliers/pages/SuppliersPage'))
const HistoryPage = lazy(() => import('../transactions/pages/HistoryPage'))
const UsersPage = lazy(() => import('../users/pages/UsersPage'))
const RequestLoginPage = lazy(() => import('../request/pages/RequestLoginPage'))
const RequestPage = lazy(() => import('../request/pages/RequestPage'))
const RequestHistoryPage = lazy(() => import('../request/pages/RequestHistoryPage'))

function PageLoading() {
  return <div style={{ padding: 24 }}>กำลังโหลด...</div>
}

function renderLazyPage(Page) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Page />
    </Suspense>
  )
}

function PortalHome() {
  const isRequestPortal = window.location.port === '9500'

  return isRequestPortal ? renderLazyPage(RequestLoginPage) : renderLazyPage(LoginPage)
}

function HrLoginRoute() {
  return window.location.port === '9500'
    ? renderLazyPage(RequestLoginPage)
    : renderLazyPage(LoginPage)
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PortalHome />,
  },
  {
    path: '/request-login',
    element: renderLazyPage(RequestLoginPage),
  },
  {
    element: <LoginLayout />,
    children: [
      {
        path: '/login',
        element: <HrLoginRoute />,
      },
    ],
  },
  {
    path: '/request',
    element: <RequestLayout />,
    children: [
      {
        index: true,
        element: renderLazyPage(RequestPage),
      },
      {
        path: 'history',
        element: renderLazyPage(RequestHistoryPage),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <NavigateToFirstAllowed />,
          },
          {
            path: 'dashboard',
            element: (
              <RequireMenuAccess menuCode="DASHBOARD">
                {renderLazyPage(DashboardPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-issue',
            element: (
              <RequireMenuAccess menuCode="STOCK_OUT">
                {renderLazyPage(StockIssuePage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'approvals',
            element: (
              <RequireMenuAccess menuCode="APPROVALS">
                {renderLazyPage(ApprovalsPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-in',
            element: (
              <RequireMenuAccess menuCode="STOCK_IN">
                {renderLazyPage(StockInPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-adjust',
            element: (
              <RequireMenuAccess menuCode="STOCK_ADJUST">
                {renderLazyPage(StockAdjustPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'suppliers',
            element: (
              <RequireMenuAccess menuCode="SUPPLIERS">
                {renderLazyPage(SuppliersPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'products',
            element: (
              <RequireMenuAccess menuCode="PRODUCTS">
                {renderLazyPage(ProductsPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-balance',
            element: <Navigate to="/products" replace />,
          },
          {
            path: 'history',
            element: (
              <RequireMenuAccess menuCode="HISTORY">
                {renderLazyPage(HistoryPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'reports',
            element: (
              <RequireMenuAccess menuCode="REPORTS">
                {renderLazyPage(ReportsPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'users',
            element: (
              <RequireMenuAccess menuCode="USERS">
                {renderLazyPage(UsersPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: 'departments',
            element: (
              <RequireMenuAccess menuCode="DEPARTMENTS">
                {renderLazyPage(DepartmentsPage)}
              </RequireMenuAccess>
            ),
          },
        ],
      },
    ],
  },
])
