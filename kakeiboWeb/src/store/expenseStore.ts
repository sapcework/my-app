import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dbAddExpense, dbUpdateExpense, dbDeleteExpense } from '../lib/db'
import { showToast } from './toastStore'
import type { Expense } from '../types/index'

type ExpenseStore = {
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  insertExpense: (expense: Expense) => Promise<void>
  getMonthlyExpenses: (month: string) => Expense[]
  restoreExpenses: (expenses: Expense[]) => void
}

const SAVE_FAILED = '保存に失敗しました。通信状況を確認してください'
const DELETE_FAILED = '削除に失敗しました。通信状況を確認してください'

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set, get) => ({
      expenses: [],
      addExpense: async (data) => {
        const newExpense: Expense = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        set((s) => ({ expenses: [...s.expenses, newExpense] }))
        const { error } = await dbAddExpense(newExpense)
        if (error) {
          console.error('addExpense failed', error)
          set((s) => ({ expenses: s.expenses.filter((e) => e.id !== newExpense.id) }))
          showToast({ message: SAVE_FAILED })
        }
      },
      updateExpense: async (id, data) => {
        const prev = get().expenses
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
          ),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (!updated) return
        const { error } = await dbUpdateExpense(updated)
        if (error) {
          console.error('updateExpense failed', error)
          set({ expenses: prev })
          showToast({ message: SAVE_FAILED })
        }
      },
      deleteExpense: async (id) => {
        const prev = get().expenses
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
        const { error } = await dbDeleteExpense(id)
        if (error) {
          console.error('deleteExpense failed', error)
          set({ expenses: prev })
          showToast({ message: DELETE_FAILED })
        }
      },
      insertExpense: async (expense) => {
        set((s) => ({ expenses: [...s.expenses, expense] }))
        const { error } = await dbAddExpense(expense)
        if (error) {
          console.error('insertExpense failed', error)
          set((s) => ({ expenses: s.expenses.filter((e) => e.id !== expense.id) }))
          showToast({ message: SAVE_FAILED })
        }
      },
      getMonthlyExpenses: (month) =>
        get().expenses.filter((e) => e.date.startsWith(month)),
      restoreExpenses: (expenses) => set({ expenses }),
    }),
    { name: 'kakeibo-expenses' }
  )
)
