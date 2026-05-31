import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecurringExpense } from '../types'

type RecurringStore = {
  recurring: RecurringExpense[]
  addRecurring: (data: Omit<RecurringExpense, 'id'>) => void
  updateRecurring: (id: string, data: Partial<RecurringExpense>) => void
  deleteRecurring: (id: string) => void
  restoreRecurring: (recurring: RecurringExpense[]) => void
}

export const useRecurringStore = create<RecurringStore>()(
  persist(
    (set) => ({
      recurring: [],
      addRecurring: (data) =>
        set((s) => ({
          recurring: [...s.recurring, { ...data, id: crypto.randomUUID() }],
        })),
      updateRecurring: (id, data) =>
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),
      deleteRecurring: (id) =>
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),
      restoreRecurring: (recurring) => set({ recurring }),
    }),
    { name: 'kakeibo-recurring' }
  )
)
