import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { loadAllFromSupabase } from '../lib/db'
import { useExpenseStore } from './expenseStore'
import { useCategoryStore, DEFAULT_CATEGORIES } from './categoryStore'
import { useBudgetStore } from './budgetStore'
import { useRecurringStore } from './recurringStore'
import type { User } from '@supabase/supabase-js'

type AuthStore = {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const clearStores = () => {
  useExpenseStore.getState().restoreExpenses([])
  useBudgetStore.getState().restoreBudgets([])
  useRecurringStore.getState().restoreRecurring([])
  useCategoryStore.getState().restoreCategories([]) // カテゴリも消去しユーザー間の残存を防ぐ
}

const loadStores = async () => {
  const data = await loadAllFromSupabase()
  useExpenseStore.getState().restoreExpenses(data.expenses)
  // 0件でも必ず上書き（前ユーザーのカテゴリ残存を防ぐ）。空ならデフォルトに戻す
  useCategoryStore.getState().restoreCategories(
    data.categories.length > 0 ? data.categories : DEFAULT_CATEGORIES
  )
  useBudgetStore.getState().restoreBudgets(data.budgets)
  useRecurringStore.getState().restoreRecurring(data.recurring)
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user })
      await loadStores()
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ user: session.user })
        await loadStores()
      }
      if (event === 'SIGNED_OUT') {
        set({ user: null })
        clearStores()
      }
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },
}))
