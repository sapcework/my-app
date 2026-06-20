import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { loadAllFromSupabase } from '../lib/db'
import { useExpenseStore } from './expenseStore'
import { useCategoryStore } from './categoryStore'
import { useBudgetStore } from './budgetStore'
import { useRecurringStore } from './recurringStore'
import type { User } from '@supabase/supabase-js'

type AuthStore = {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const clearStores = () => {
  useExpenseStore.getState().restoreExpenses([])
  useBudgetStore.getState().restoreBudgets([])
  useRecurringStore.getState().restoreRecurring([])
}

const loadStores = async () => {
  const data = await loadAllFromSupabase()
  useExpenseStore.getState().restoreExpenses(data.expenses)
  if (data.categories.length > 0)
    useCategoryStore.getState().restoreCategories(data.categories)
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

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },
}))
