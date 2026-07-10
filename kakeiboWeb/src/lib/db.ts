import { supabase } from './supabase'
import type { Expense, Category, Budget, RecurringExpense } from '../types/index'

const uid = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ─── Expense ─────────────────────────────────────────────────────────────────

type DbExpenseRow = {
  id: string
  amount: number
  category_id: string
  item_name: string | null
  note: string | null
  date: string
  created_at: string
  updated_at: string | null
}

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

export const fromDbExpense = (r: DbExpenseRow): Expense => ({
  id: r.id,
  amount: r.amount,
  categoryId: r.category_id,
  itemName: r.item_name ?? undefined,
  note: r.note ?? '',
  date: r.date,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
})

export const dbAddExpense = async (e: Expense) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('expenses').insert(toDbExpense(e, userId))
  return { error }
}

export const dbUpdateExpense = async (e: Expense) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('expenses').update(toDbExpense(e, userId)).eq('id', e.id).eq('user_id', userId)
  return { error }
}

export const dbDeleteExpense = async (id: string) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId)
  return { error }
}

// ─── Category ────────────────────────────────────────────────────────────────

type DbCategoryRow = {
  id: string
  name: string
  color: string
  icon: string
}

const toDbCategory = (c: Category, userId: string, order: number) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  color: c.color,
  icon: c.icon,
  sort_order: order,
})

export const fromDbCategory = (r: DbCategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon,
})

export const dbAddCategory = async (c: Category, order: number) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('categories').insert(toDbCategory(c, userId, order))
  return { error }
}

export const dbUpdateCategory = async (c: Category) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase
    .from('categories')
    .update({ name: c.name, color: c.color, icon: c.icon })
    .eq('id', c.id)
    .eq('user_id', userId)
  return { error }
}

export const dbDeleteCategory = async (id: string) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
  return { error }
}

// ─── Budget ──────────────────────────────────────────────────────────────────

type DbBudgetRow = {
  month: string
  amount: number
}

export const fromDbBudget = (r: DbBudgetRow): Budget => ({
  month: r.month,
  amount: r.amount,
})

export const dbSetBudget = async (month: string, amount: number) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('budgets').upsert({ user_id: userId, month, amount })
  return { error }
}

// ─── RecurringExpense ─────────────────────────────────────────────────────────

type DbRecurringRow = {
  id: string
  amount: number
  category_id: string
  name: string
  day_of_month: number
  last_generated_month: string | null
}

const toDbRecurring = (r: RecurringExpense, userId: string) => ({
  id: r.id,
  user_id: userId,
  amount: r.amount,
  category_id: r.categoryId,
  name: r.name,
  day_of_month: r.dayOfMonth,
  last_generated_month: r.lastGeneratedMonth ?? null,
})

export const fromDbRecurring = (r: DbRecurringRow): RecurringExpense => ({
  id: r.id,
  amount: r.amount,
  categoryId: r.category_id,
  name: r.name,
  dayOfMonth: r.day_of_month,
  lastGeneratedMonth: r.last_generated_month ?? undefined,
})

export const dbAddRecurring = async (r: RecurringExpense) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('recurring_expenses').insert(toDbRecurring(r, userId))
  return { error }
}

export const dbUpdateRecurring = async (r: RecurringExpense) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('recurring_expenses').update(toDbRecurring(r, userId)).eq('id', r.id).eq('user_id', userId)
  return { error }
}

export const dbDeleteRecurring = async (id: string) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id).eq('user_id', userId)
  return { error }
}

// ─── バックアップ復元（全データ置き換え） ──────────────────────────────────────

export const dbRestoreAll = async (data: {
  expenses: Expense[]
  categories: Category[]
  budgets: Budget[]
  recurring: RecurringExpense[]
}) => {
  const userId = await uid(); if (!userId) return { error: new Error('not signed in') }

  const deletes = await Promise.all([
    supabase.from('expenses').delete().eq('user_id', userId),
    supabase.from('categories').delete().eq('user_id', userId),
    supabase.from('budgets').delete().eq('user_id', userId),
    supabase.from('recurring_expenses').delete().eq('user_id', userId),
  ])
  const deleteError = deletes.find((r) => r.error)?.error
  if (deleteError) return { error: deleteError }

  const inserts = await Promise.all([
    data.expenses.length > 0
      ? supabase.from('expenses').insert(data.expenses.map((e) => toDbExpense(e, userId)))
      : Promise.resolve({ error: null }),
    data.categories.length > 0
      ? supabase.from('categories').insert(data.categories.map((c, i) => toDbCategory(c, userId, i)))
      : Promise.resolve({ error: null }),
    data.budgets.length > 0
      ? supabase.from('budgets').insert(data.budgets.map((b) => ({ user_id: userId, month: b.month, amount: b.amount })))
      : Promise.resolve({ error: null }),
    data.recurring.length > 0
      ? supabase.from('recurring_expenses').insert(data.recurring.map((r) => toDbRecurring(r, userId)))
      : Promise.resolve({ error: null }),
  ])
  const insertError = inserts.find((r) => r.error)?.error
  return { error: insertError ?? null }
}

// ─── 全データ取得（ログイン時） ────────────────────────────────────────────────

export const loadAllFromSupabase = async () => {
  const [expenses, categories, budgets, recurring] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('budgets').select('*'),
    supabase.from('recurring_expenses').select('*'),
  ])
  // Supabaseクライアントはテーブル定義を持たないため、ここが唯一の型境界（DBの実スキーマを信頼してキャストする）
  return {
    expenses: ((expenses.data ?? []) as DbExpenseRow[]).map(fromDbExpense),
    categories: ((categories.data ?? []) as DbCategoryRow[]).map(fromDbCategory),
    budgets: ((budgets.data ?? []) as DbBudgetRow[]).map(fromDbBudget),
    recurring: ((recurring.data ?? []) as DbRecurringRow[]).map(fromDbRecurring),
  }
}
