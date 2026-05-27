export type Category = {
  id: string
  name: string
  color: string
  icon: string
}

export type Expense = {
  id: string
  amount: number
  categoryId: string
  itemName?: string // 項目名（任意）
  note: string      // メモ（任意）
  date: string      // ISO 8601 (YYYY-MM-DD)
  createdAt: string
}

export type Budget = {
  month: string // YYYY-MM
  amount: number
}

export type RecurringExpense = {
  id: string
  amount: number
  categoryId: string
  name: string       // 支出名（必須）
  dayOfMonth: number // 毎月何日に発生するか
}
