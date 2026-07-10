import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbAddRecurring, dbUpdateRecurring, dbDeleteRecurring } from '../lib/db'
import { showToast } from './toastStore'
import type { RecurringExpense } from '../types/index'

type RecurringStore = {
  recurring: RecurringExpense[]
  addRecurring: (data: Omit<RecurringExpense, 'id'>) => Promise<void>
  updateRecurring: (id: string, data: Partial<RecurringExpense>) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>
  restoreRecurring: (recurring: RecurringExpense[]) => void
}

const SAVE_FAILED = '保存に失敗しました。通信状況を確認してください'
const DELETE_FAILED = '削除に失敗しました。通信状況を確認してください'

export const useRecurringStore = create<RecurringStore>()(
  persist(
    (set, get) => ({
      recurring: [],
      addRecurring: async (data) => {
        const newItem: RecurringExpense = { ...data, id: crypto.randomUUID() }
        set((s) => ({ recurring: [...s.recurring, newItem] }))
        const { error } = await dbAddRecurring(newItem)
        if (error) {
          console.error('addRecurring failed', error)
          set((s) => ({ recurring: s.recurring.filter((r) => r.id !== newItem.id) }))
          showToast({ message: SAVE_FAILED })
        }
      },
      updateRecurring: async (id, data) => {
        const prev = get().recurring
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }))
        const updated = get().recurring.find((r) => r.id === id)
        if (!updated) return
        const { error } = await dbUpdateRecurring(updated)
        if (error) {
          console.error('updateRecurring failed', error)
          set({ recurring: prev })
          showToast({ message: SAVE_FAILED })
        }
      },
      deleteRecurring: async (id) => {
        const prev = get().recurring
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
        const { error } = await dbDeleteRecurring(id)
        if (error) {
          console.error('deleteRecurring failed', error)
          set({ recurring: prev })
          showToast({ message: DELETE_FAILED })
        }
      },
      restoreRecurring: (recurring) => set({ recurring }),
    }),
    { name: 'kakeibo-recurring' }
  )
)
