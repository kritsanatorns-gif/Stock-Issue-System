import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { login as loginRequest } from '../api/api'

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000

const normalizeAuthResponse = (data) => {
  const token = data?.token ?? data?.accessToken ?? ''
  const employee = data?.employee ?? data?.user ?? null
  const roles = data?.roles ?? employee?.roles ?? []

  return {
    token,
    employee,
    roles,
  }
}

export const useAuthStore = create(
  persist(
    (set) => ({
      token: '',
      employee: null,
      roles: [],
      expiresAt: 0,
      isAuthenticated: false,

      login: async (credentials) => {
        const data = await loginRequest(credentials)
        const authState = normalizeAuthResponse(data)
        const expiresAt = Date.now() + SESSION_DURATION_MS

        if (authState.token) {
          localStorage.setItem('accessToken', authState.token)
          localStorage.setItem('authExpiresAt', String(expiresAt))
        }

        set({
          ...authState,
          expiresAt,
          isAuthenticated: Boolean(authState.token),
        })

        return data
      },

      logout: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('authExpiresAt')

        set({
          token: '',
          employee: null,
          roles: [],
          expiresAt: 0,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'stock-issue-auth',
      partialize: (state) => ({
        token: state.token,
        employee: state.employee,
        roles: state.roles,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.expiresAt && state.expiresAt > Date.now()) {
          localStorage.setItem('accessToken', state.token)
          localStorage.setItem('authExpiresAt', String(state.expiresAt))
        } else if (state?.token) {
          state.logout()
        }
      },
    },
  ),
)
