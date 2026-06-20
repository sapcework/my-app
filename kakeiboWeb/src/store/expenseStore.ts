import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbAddExpense, dbUpdateExpense, dbDeleteExpense } from '../lib/db'
import type { Expense } from '../types/index'

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
      addExpense: (data) => {
        const newExpense: Expense = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        set((s) => ({ expenses: [...s.expenses, newExpense] }))
        dbAddExpense(newExpense)
      },
      updateExpense: (id, data) => {
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
          ),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated) dbUpdateExpense(updated)
      },
      deleteExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
        dbDeleteExpense(id)
      },
      insertExpense: (expense) => {
        set((s) => ({ expenses: [...s.expenses, expense] }))
        dbAddExpense(expense)
      },
      getMonthlyExpenses: (month) =>
        get().expenses.filter((e) => e.date.startsWith(month)),
      restoreExpenses: (expenses) => set({ expenses }),
    }),
    { name: 'kakeibo-expenses' }
  )
)
