import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Budget } from '../types'

type BudgetStore = {
  budgets: Budget[]
  setBudget: (month: string, amount: number) => void
  getBudget: (month: string) => number
  restoreBudgets: (budgets: Budget[]) => void
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      budgets: [],
      setBudget: (month, amount) =>
        set((s) => {
          const exists = s.budgets.find((b) => b.month === month)
          if (exists) {
            return { budgets: s.budgets.map((b) => (b.month === month ? { ...b, amount } : b)) }
          }
          return { budgets: [...s.budgets, { month, amount }] }
        }),
      getBudget: (month) => get().budgets.find((b) => b.month === month)?.amount ?? 0,
      restoreBudgets: (budgets) => set({ budgets }),
    }),
    { name: 'kakeibo-budgets' }
  )
)
