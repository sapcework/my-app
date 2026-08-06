import type { Expense, Category, Budget, RecurringExpense } from '../types/index'
import { BACKUP_VERSION } from '../constants/app'
import { toEmoji, toIconName } from './categoryIcon'

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
const isNonEmptyStr = (v: unknown): v is string => isStr(v) && v.length > 0
const isOptStr = (v: unknown): v is string | undefined => v === undefined || v === null || typeof v === 'string'
const isAmount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000_000 // 金額は0〜10億円の範囲のみ許可
const isDayOfMonth = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 31

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD
const MONTH_RE = /^\d{4}-\d{2}$/ // YYYY-MM
const COLOR_RE = /^#[0-9a-fA-F]{6}$/ // #RRGGBB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── v1（Web版が従来書き出していた形式） ─────────────────────────────────────

const isExpense = (v: unknown): v is Expense =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isAmount(v.amount) &&
  isStr(v.categoryId) &&
  isOptStr(v.itemName) &&
  isStr(v.note) &&
  isStr(v.date) && DATE_RE.test(v.date) &&
  isStr(v.createdAt) &&
  isOptStr(v.updatedAt)

const isCategory = (v: unknown): v is Category =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isNonEmptyStr(v.name) &&
  isStr(v.color) &&
  isStr(v.icon)

const isBudget = (v: unknown): v is Budget =>
  isObj(v) &&
  isStr(v.month) && MONTH_RE.test(v.month) &&
  isAmount(v.amount)

const isRecurring = (v: unknown): v is RecurringExpense =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isAmount(v.amount) &&
  isStr(v.categoryId) &&
  isNonEmptyStr(v.name) &&
  isDayOfMonth(v.dayOfMonth) &&
  isOptStr(v.lastGeneratedMonth)

// ─── v2（Flutter版と共通の移行フォーマット） ──────────────────────────────────
// 仕様: docs/backup-format-v2.md
// ID は両アプリで型が異なる（Web=UUID文字列 / Flutter=整数）ため、v2 では
// 「ファイル内でのみ有効な参照キー」と定義し、取り込む側が自分のID体系に振り直す。

type V2Category = { id: string; name: string; color: string; icon?: string; iconName?: string; sortOrder?: number }
type V2Expense = {
  id: string; amount: number; categoryId: string
  itemName?: string; note?: string; date: string; createdAt: string; updatedAt?: string
}
type V2Budget = { month: string; amount: number }
type V2Recurring = {
  id: string; name: string; amount: number; categoryId: string
  dayOfMonth: number; isActive?: boolean; lastGeneratedMonth?: string
}

const isV2Category = (v: unknown): v is V2Category =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isNonEmptyStr(v.name) &&
  isStr(v.color) && COLOR_RE.test(v.color) &&
  (isNonEmptyStr(v.icon) || isNonEmptyStr(v.iconName)) && // どちらか一方あればよい
  (v.sortOrder === undefined || (typeof v.sortOrder === 'number' && Number.isInteger(v.sortOrder)))

const isV2Expense = (v: unknown): v is V2Expense =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isAmount(v.amount) &&
  isNonEmptyStr(v.categoryId) &&
  isOptStr(v.itemName) &&
  isOptStr(v.note) &&
  isStr(v.date) && DATE_RE.test(v.date) &&
  isNonEmptyStr(v.createdAt) &&
  isOptStr(v.updatedAt)

const isV2Budget = (v: unknown): v is V2Budget =>
  isObj(v) && isStr(v.month) && MONTH_RE.test(v.month) && isAmount(v.amount)

const isV2Recurring = (v: unknown): v is V2Recurring =>
  isObj(v) &&
  isNonEmptyStr(v.id) &&
  isNonEmptyStr(v.name) &&
  isAmount(v.amount) &&
  isNonEmptyStr(v.categoryId) &&
  isDayOfMonth(v.dayOfMonth) &&
  (v.isActive === undefined || typeof v.isActive === 'boolean') &&
  isOptStr(v.lastGeneratedMonth)

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}` // 非対応環境向けの保険

// 支出・定期支出の ID は Flutter版だと "1" のような整数文字列になる。Supabase 側が uuid 型の
// 可能性があるため、UUID でない ID は取り込み時に採番し直す（カテゴリ参照も同時に付け替える）。
// カテゴリIDは既定カテゴリが '1'〜'16' で運用されている＝テキスト型と分かっているのでそのまま使う。
const adoptId = (id: string): string => (UUID_RE.test(id) ? id : newId())

// v2 → Web版の内部形式
const fromV2 = (raw: Record<string, unknown>): BackupData => {
  const v2Categories = (raw.categories ?? []) as V2Category[]
  const v2Expenses = (raw.expenses ?? []) as V2Expense[]
  const v2Budgets = (raw.budgets ?? []) as V2Budget[]
  const v2Recurring = (raw.recurring ?? []) as V2Recurring[]

  const sorted = [...v2Categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) // sortOrder は配列順で表現する
  const categories: Category[] = sorted.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon ?? toEmoji(c.iconName ?? ''), // 絵文字が無ければ Material アイコン名から変換する
  }))

  const expenses: Expense[] = v2Expenses.map((e) => ({
    id: adoptId(e.id),
    amount: e.amount,
    categoryId: e.categoryId, // カテゴリIDは振り直さないので参照はそのまま使える
    itemName: e.itemName || undefined,
    note: e.note ?? '',
    date: e.date,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt || undefined,
  }))

  const budgets: Budget[] = v2Budgets.map((b) => ({ month: b.month, amount: b.amount }))

  const recurring: RecurringExpense[] = v2Recurring
    .filter((r) => r.isActive !== false) // Web版に「無効」の概念が無いため、無効な定期支出は取り込まない
    .map((r) => ({
      id: adoptId(r.id),
      name: r.name,
      amount: r.amount,
      categoryId: r.categoryId,
      dayOfMonth: r.dayOfMonth,
      lastGeneratedMonth: r.lastGeneratedMonth || undefined,
    }))

  return {
    version: '2',
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
    expenses,
    categories,
    budgets,
    recurring,
  }
}

// ─── 書き出し ────────────────────────────────────────────────────────────────

// Web版の内部形式 → v2（Flutter版でもそのまま復元できる形式）
export const buildBackup = (data: {
  expenses: Expense[]
  categories: Category[]
  budgets: Budget[]
  recurring: RecurringExpense[]
}) => ({
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  app: 'kakeibo-web',
  categories: data.categories.map((c, i) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    iconName: toIconName(c.icon), // Flutter版が読むフィールド
    sortOrder: i, // Web版は配列順が表示順
  })),
  expenses: data.expenses.map((e) => ({
    id: e.id,
    amount: e.amount,
    categoryId: e.categoryId,
    itemName: e.itemName ?? '',
    note: e.note ?? '',
    date: e.date,
    createdAt: e.createdAt,
    ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}),
  })),
  budgets: data.budgets.map((b) => ({ month: b.month, amount: b.amount })),
  recurring: data.recurring.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    categoryId: r.categoryId,
    dayOfMonth: r.dayOfMonth,
    isActive: true, // Web版に無効の概念が無いため常に有効として書き出す
    ...(r.lastGeneratedMonth ? { lastGeneratedMonth: r.lastGeneratedMonth } : {}),
  })),
})

// ─── 読み込み ────────────────────────────────────────────────────────────────

// Flutter版が version:"1" で書き出していた旧形式かどうか（IDが整数・カテゴリが colorValue を持つ）
const isFlutterV1 = (raw: Record<string, unknown>): boolean => {
  const rows = [
    ...(Array.isArray(raw.expenses) ? raw.expenses : []),
    ...(Array.isArray(raw.categories) ? raw.categories : []),
  ]
  return rows.some((r) => isObj(r) && (typeof r.id === 'number' || 'colorValue' in r || 'memo' in r))
}

const checkAll = <T>(arr: unknown, guard: (v: unknown) => v is T, label: string): string | null => {
  if (!Array.isArray(arr)) return `${label}の形式が不正です`
  const badIndex = arr.findIndex((v) => !guard(v))
  if (badIndex >= 0) return `${label}の${badIndex + 1}件目のデータが不正です`
  return null
}

// バックアップJSON文字列を検証付きでパースする。v1（Web版の旧形式）と v2（両アプリ共通形式）を読める。
// 1件でも不正な行があればファイル全体を拒否する（部分復元によるデータ不整合を防ぐため）。
export const parseBackup = (json: string): ParseResult => {
  let raw: unknown
  try {
    raw = JSON.parse(json.charCodeAt(0) === 0xfeff ? json.slice(1) : json) // 他アプリ経由のファイルはBOM付きのことがある
  } catch {
    return { ok: false, error: 'JSONとして読み込めませんでした' }
  }
  if (!isObj(raw)) return { ok: false, error: 'バックアップファイルの形式が不正です' }

  const version = isStr(raw.version) ? raw.version : '1'

  if (version === '2') {
    const err =
      checkAll(raw.expenses ?? [], isV2Expense, '支出データ') ??
      checkAll(raw.categories ?? [], isV2Category, 'カテゴリ') ??
      checkAll(raw.budgets ?? [], isV2Budget, '予算') ??
      checkAll(raw.recurring ?? [], isV2Recurring, '定期支出')
    if (err) return { ok: false, error: err }
    return { ok: true, data: fromV2(raw) }
  }

  if (version !== '1') {
    return { ok: false, error: `対応していないバックアップ形式です（version: ${version}）` }
  }

  // version:"1" は Web版とFlutter版で中身が別物なので、Flutter版の旧形式は見分けて案内する
  if (isFlutterV1(raw)) {
    return {
      ok: false,
      error: 'アプリ版の旧形式（v1）です。アプリ側で再度バックアップを取り直してください（新しい共通形式で書き出されます）',
    }
  }

  const err =
    checkAll(raw.expenses, isExpense, '支出データ') ??
    checkAll(raw.categories, isCategory, 'カテゴリ') ??
    checkAll(raw.budgets ?? [], isBudget, '予算') ??
    checkAll(raw.recurring ?? [], isRecurring, '定期支出')
  if (err) return { ok: false, error: err }

  return {
    ok: true,
    data: {
      version: '1',
      exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
      expenses: raw.expenses as Expense[],
      categories: raw.categories as Category[],
      budgets: (raw.budgets ?? []) as Budget[],
      recurring: (raw.recurring ?? []) as RecurringExpense[],
    },
  }
}
