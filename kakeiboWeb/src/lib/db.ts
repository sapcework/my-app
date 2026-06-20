import { supabase } from './supabase'
import type { Expense, Category, Budget, RecurringExpense } from '../types/index'

const uid = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── Expense ─────────────────────────────────────────────────────────────────

const toDbExpense = (e: Expense, userId: string) => ({
  id: e.id,
  user_id: userId,
  amount: e.amount,
  category_id: e.categoryId,
  item_name: e.itemName ?? null,
  note: e.note,
  date: e.date,
  created_at: e.createdAt,
  updated_at: e.updatedAt ?? null,
})

export const fromDbExpense = (r: Record<string, unknown>): Expense => ({
  id: r.id as string,
  amount: r.amount as number,
  categoryId: r.category_id as string,
  itemName: (r.item_name as string | null) ?? undefined,
  note: (r.note as string) ?? '',
  date: r.date as string,
  createdAt: r.created_at as string,
  updatedAt: (r.updated_at as string | null) ?? undefined,
})

export const dbAddExpense = async (e: Expense) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('expenses').insert(toDbExpense(e, userId))
}

export const dbUpdateExpense = async (e: Expense) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('expenses').upsert(toDbExpense(e, userId))
}

export const dbDeleteExpense = async (id: string) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId)
}

// ─── Category ────────────────────────────────────────────────────────────────

const toDbCategory = (c: Category, userId: string, order: number) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  color: c.color,
  icon: c.icon,
  sort_order: order,
})

export const fromDbCategory = (r: Record<string, unknown>): Category => ({
  id: r.id as string,
  name: r.name as string,
  color: r.color as string,
  icon: r.icon as string,
})

export const dbSyncCategories = async (categories: Category[]) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('categories').delete().eq('user_id', userId)
  if (categories.length > 0) {
    await supabase.from('categories').insert(
      categories.map((c, i) => toDbCategory(c, userId, i))
    )
  }
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export const fromDbBudget = (r: Record<string, unknown>): Budget => ({
  month: r.month as string,
  amount: r.amount as number,
})

export const dbSetBudget = async (month: string, amount: number) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('budgets').upsert({ user_id: userId, month, amount })
}

// ─── RecurringExpense ─────────────────────────────────────────────────────────

const toDbRecurring = (r: RecurringExpense, userId: string) => ({
  id: r.id,
  user_id: userId,
  amount: r.amount,
  category_id: r.categoryId,
  name: r.name,
  day_of_month: r.dayOfMonth,
})

export const fromDbRecurring = (r: Record<string, unknown>): RecurringExpense => ({
  id: r.id as string,
  amount: r.amount as number,
  categoryId: r.category_id as string,
  name: r.name as string,
  dayOfMonth: r.day_of_month as number,
})

export const dbAddRecurring = async (r: RecurringExpense) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('recurring_expenses').insert(toDbRecurring(r, userId))
}

export const dbUpdateRecurring = async (r: RecurringExpense) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('recurring_expenses').upsert(toDbRecurring(r, userId))
}

export const dbDeleteRecurring = async (id: string) => {
  const userId = await uid(); if (!userId) return
  await supabase.from('recurring_expenses').delete().eq('id', id).eq('user_id', userId)
}

// ─── 全データ取得（ログイン時） ────────────────────────────────────────────────

export const loadAllFromSupabase = async () => {
  const [expenses, categories, budgets, recurring] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('budgets').select('*'),
    supabase.from('recurring_expenses').select('*'),
  ])
  return {
    expenses: (expenses.data ?? []).map(fromDbExpense),
    categories: (categories.data ?? []).map(fromDbCategory),
    budgets: (budgets.data ?? []).map(fromDbBudget),
    recurring: (recurring.data ?? []).map(fromDbRecurring),
  }
}
