import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbAddRecurring, dbUpdateRecurring, dbDeleteRecurring } from '../lib/db'
import type { RecurringExpense } from '../types/index'

type RecurringStore = {
  recurring: RecurringExpense[]
  addRecurring: (data: Omit<RecurringExpense, 'id'>) => void
  updateRecurring: (id: string, data: Partial<RecurringExpense>) => void
  deleteRecurring: (id: string) => void
  restoreRecurring: (recurring: RecurringExpense[]) => void
}

export const useRecurringStore = create<RecurringStore>()(
  persist(
    (set, get) => ({
      recurring: [],
      addRecurring: (data) => {
        const newItem: RecurringExpense = { ...data, id: crypto.randomUUID() }
        set((s) => ({ recurring: [...s.recurring, newItem] }))
        dbAddRecurring(newItem)
      },
      updateRecurring: (id, data) => {
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }))
        const updated = get().recurring.find((r) => r.id === id)
        if (updated) dbUpdateRecurring(updated)
      },
      deleteRecurring: (id) => {
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
        dbDeleteRecurring(id)
      },
      restoreRecurring: (recurring) => set({ recurring }),
    }),
    { name: 'kakeibo-recurring' }
  )
)
