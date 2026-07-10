import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbSetBudget } from '../lib/db'
import { showToast } from './toastStore'
import type { Budget } from '../types/index'

type BudgetStore = {
  budgets: Budget[]
  setBudget: (month: string, amount: number) => Promise<void>
  getBudget: (month: string) => number
  restoreBudgets: (budgets: Budget[]) => void
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      budgets: [],
      setBudget: async (month, amount) => {
        const prev = get().budgets
        set((s) => {
          const exists = s.budgets.find((b) => b.month === month)
          if (exists) {
            return { budgets: s.budgets.map((b) => (b.month === month ? { ...b, amount } : b)) }
          }
          return { budgets: [...s.budgets, { month, amount }] }
        })
        const { error } = await dbSetBudget(month, amount)
        if (error) {
          console.error('setBudget failed', error)
          set({ budgets: prev })
          showToast({ message: '予算の保存に失敗しました。通信状況を確認してください' })
        }
      },
      getBudget: (month) => get().budgets.find((b) => b.month === month)?.amount ?? 0,
      restoreBudgets: (budgets) => set({ budgets }),
    }),
    { name: 'kakeibo-budgets' }
  )
)
