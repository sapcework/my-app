import type { Expense, Category, Budget, RecurringExpense } from '../types/index'

export type BackupData = {
  version: string
  exportedAt: string
  expenses: Expense[]
  categories: Category[]
  budgets: Budget[]
  recurring: RecurringExpense[]
}

export type ParseResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isStr = (v: unknown): v is string => typeof v === 'string'
const isOptStr = (v: unknown): v is string | undefined => v === undefined || typeof v === 'string'
const isAmount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000_000 // 金額は0〜10億円の範囲のみ許可

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD
const MONTH_RE = /^\d{4}-\d{2}$/ // YYYY-MM

const isExpense = (v: unknown): v is Expense =>
  isObj(v) &&
  isStr(v.id) && v.id.length > 0 &&
  isAmount(v.amount) &&
  isStr(v.categoryId) &&
  isOptStr(v.itemName) &&
  isStr(v.note) &&
  isStr(v.date) && DATE_RE.test(v.date) &&
  isStr(v.createdAt) &&
  isOptStr(v.updatedAt)

const isCategory = (v: unknown): v is Category =>
  isObj(v) &&
  isStr(v.id) && v.id.length > 0 &&
  isStr(v.name) && v.name.length > 0 &&
  isStr(v.color) &&
  isStr(v.icon)

const isBudget = (v: unknown): v is Budget =>
  isObj(v) &&
  isStr(v.month) && MONTH_RE.test(v.month) &&
  isAmount(v.amount)

const isRecurring = (v: unknown): v is RecurringExpense =>
  isObj(v) &&
  isStr(v.id) && v.id.length > 0 &&
  isAmount(v.amount) &&
  isStr(v.categoryId) &&
  isStr(v.name) && v.name.length > 0 &&
  typeof v.dayOfMonth === 'number' && Number.isInteger(v.dayOfMonth) && v.dayOfMonth >= 1 && v.dayOfMonth <= 31 &&
  isOptStr(v.lastGeneratedMonth)

const checkAll = <T>(arr: unknown, guard: (v: unknown) => v is T, label: string): string | null => {
  if (!Array.isArray(arr)) return `${label}の形式が不正です`
  const badIndex = arr.findIndex((v) => !guard(v))
  if (badIndex >= 0) return `${label}の${badIndex + 1}件目のデータが不正です`
  return null
}

// バックアップJSON文字列を検証付きでパースする。
// 1件でも不正な行があればファイル全体を拒否する（部分復元によるデータ不整合を防ぐため）。
export const parseBackup = (json: string): ParseResult => {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'JSONとして読み込めませんでした' }
  }
  if (!isObj(raw)) return { ok: false, error: 'バックアップファイルの形式が不正です' }

  const err =
    checkAll(raw.expenses, isExpense, '支出データ') ??
    checkAll(raw.categories, isCategory, 'カテゴリ') ??
    checkAll(raw.budgets ?? [], isBudget, '予算') ??
    checkAll(raw.recurring ?? [], isRecurring, '定期支出')
  if (err) return { ok: false, error: err }

  return {
    ok: true,
    data: {
      version: isStr(raw.version) ? raw.version : '1',
      exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
      expenses: raw.expenses as Expense[],
      categories: raw.categories as Category[],
      budgets: (raw.budgets ?? []) as Budget[],
      recurring: (raw.recurring ?? []) as RecurringExpense[],
    },
  }
}
