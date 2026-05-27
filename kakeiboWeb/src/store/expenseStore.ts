import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Expense } from '../types'

type ExpenseStore = {
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  updateExpense: (id: string, data: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  getMonthlyExpenses: (month: string) => Expense[] // month: YYYY-MM
}

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set, get) => ({
      expenses: [],
      addExpense: (data) =>
        set((s) => ({
          expenses: [
            ...s.expenses,
            { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
          ],
        })),
      updateExpense: (id, data) =>
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      getMonthlyExpenses: (month) =>
        get().expenses.filter((e) => e.date.startsWith(month)),
    }),
    { name: 'kakeibo-expenses' }
  )
)
