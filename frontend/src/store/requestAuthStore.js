import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000

export const useRequestAuthStore = create(
  persist(
    (set) => ({
      employee: null,
      expiresAt: 0,
      isAuthenticated: false,
      token: '',

      login: async ({ username, department, division, employeeCode, employeeName, unitRef, unitName }) => {
        const expiresAt = Date.now() + SESSION_DURATION_MS
        const safeUsername = username.trim()
        const safeDepartment = department.trim()
        const safeDivision = String(division ?? '').trim()
        const safeEmployeeCode = String(employeeCode ?? '').trim()
        const safeEmployeeName = String(employeeName ?? safeUsername).trim()
        const safeUnitRef = String(unitRef ?? '').trim()
        const safeUnitName = String(unitName ?? '').trim()

        useAuthStore.getState().logout()

        set({
          employee: {
            department: safeDepartment,
            division: safeDivision,
            employeeCode: safeEmployeeCode,
            employeeId: Number(safeEmployeeCode) || 0,
            employeeName: safeEmployeeName,
            name: safeEmployeeName,
            unitRef: safeUnitRef,
            unitName: safeUnitName,
            username: safeUsername,
          },
          expiresAt,
          isAuthenticated: true,
          token: `request-${Date.now()}`,
        })

        return {
          department: safeDepartment,
          username: safeUsername,
        }
      },

      logout: () => {
        set({
          employee: null,
          expiresAt: 0,
          isAuthenticated: false,
          token: '',
        })
      },
    }),
    {
      name: 'stock-request-auth',
      partialize: (state) => ({
        employee: state.employee,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.expiresAt && state.expiresAt <= Date.now()) {
          state.logout()
        }
      },
    },
  ),
)
