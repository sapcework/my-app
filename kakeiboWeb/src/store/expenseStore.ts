import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Expense } from '../types'

type ExpenseStore = {
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  updateExpense: (id: string, data: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  insertExpense: (expense: Expense) => void
  getMonthlyExpenses: (month: string) => Expense[]
  restoreExpenses: (expenses: Expense[]) => void
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
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
          ),
        })),
      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      insertExpense: (expense) =>
        set((s) => ({ expenses: [...s.expenses, expense] })), // 既存の支出をそのまま復活（Undo用）
      getMonthlyExpenses: (month) =>
        get().expenses.filter((e) => e.date.startsWith(month)),
      restoreExpenses: (expenses) => set({ expenses }),
    }),
    { name: 'kakeibo-expenses' }
  )
)
