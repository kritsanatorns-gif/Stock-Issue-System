import { Navigate, createBrowserRouter } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import LoginLayout from '../layouts/LoginLayout'
import NavigateToFirstAllowed from '../auth/components/NavigateToFirstAllowed'
import RequireAuth from '../auth/components/RequireAuth'
import RequireMenuAccess from '../auth/components/RequireMenuAccess'
import LoginPage from '../auth/pages/LoginPage'
import ApprovalsPage from '../approvals/pages/ApprovalsPage'
import DashboardPage from '../Dashboard/pages/DashboardPage'
import DepartmentsPage from '../departments/pages/DepartmentsPage'
import ProductsPage from '../products/pages/ProductsPage'
import ReportsPage from '../reports/pages/ReportsPage'
import StockAdjustPage from '../stockAdjust/pages/StockAdjustPage'
import StockInPage from '../stockIn/pages/StockInPage'
import StockIssuePage from '../stockIssue/pages/StockOutPage'
import SuppliersPage from '../suppliers/pages/SuppliersPage'
import HistoryPage from '../transactions/pages/HistoryPage'
import UsersPage from '../users/pages/UsersPage'
import RequestLoginPage from '../request/pages/RequestLoginPage'
import RequestPage from '../request/pages/RequestPage'
import RequestHistoryPage from '../request/pages/RequestHistoryPage'
import RequestLayout from '../request/layouts/RequestLayout'

export const router = createBrowserRouter([
  {
    path: '/request-login',
    element: <RequestLoginPage />,
  },
  {
    element: <LoginLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '/request',
    element: <RequestLayout />,
    children: [
      {
        index: true,
        element: <RequestPage />,
      },
      {
        path: 'history',
        element: <RequestHistoryPage />,
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
                <DashboardPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-issue',
            element: (
              <RequireMenuAccess menuCode="STOCK_OUT">
                <StockIssuePage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'approvals',
            element: (
              <RequireMenuAccess menuCode="APPROVALS">
                <ApprovalsPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-in',
            element: (
              <RequireMenuAccess menuCode="STOCK_IN">
                <StockInPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'stock-adjust',
            element: (
              <RequireMenuAccess menuCode="STOCK_ADJUST">
                <StockAdjustPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'suppliers',
            element: (
              <RequireMenuAccess menuCode="SUPPLIERS">
                <SuppliersPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'products',
            element: (
              <RequireMenuAccess menuCode="PRODUCTS">
                <ProductsPage />
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
                <HistoryPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'reports',
            element: (
              <RequireMenuAccess menuCode="REPORTS">
                <ReportsPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'users',
            element: (
              <RequireMenuAccess menuCode="USERS">
                <UsersPage />
              </RequireMenuAccess>
            ),
          },
          {
            path: 'departments',
            element: (
              <RequireMenuAccess menuCode="DEPARTMENTS">
                <DepartmentsPage />
              </RequireMenuAccess>
            ),
          },
        ],
      },
    ],
  },
])
