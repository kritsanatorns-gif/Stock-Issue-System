import { create } from 'zustand'

export const useInventoryDraftStore = create((set) => ({
  selectedItemsByMode: {
    issue: [],
    receive: [],
  },
  setSelectedItems: (mode, updater) =>
    set((state) => {
      const currentItems = state.selectedItemsByMode[mode] ?? []
      const nextItems = typeof updater === 'function' ? updater(currentItems) : updater

      return {
        selectedItemsByMode: {
          ...state.selectedItemsByMode,
          [mode]: nextItems,
        },
      }
    }),
}))
