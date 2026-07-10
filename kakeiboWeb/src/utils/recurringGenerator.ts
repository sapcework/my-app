import { useRecurringStore } from '../store/recurringStore'
import { useExpenseStore } from '../store/expenseStore'
import type { RecurringExpense } from '../types/index'

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate() // month: 1-12

const yearMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// 月末調整込みで、その月に定期支出が発生する日を返す（31日指定でも2月なら月末になる）
export const targetDayOf = (r: RecurringExpense, today: Date): number =>
  Math.min(r.dayOfMonth, daysInMonth(today.getFullYear(), today.getMonth() + 1))

// 発生日を過ぎていて今月分が未生成かどうかを判定する（副作用なし・テスト用に切り出し）
export const isRecurringDue = (r: RecurringExpense, today: Date): boolean => {
  if (r.lastGeneratedMonth === yearMonth(today)) return false // 今月分は生成済み
  return today.getDate() >= targetDayOf(r, today) // まだ発生日に達していない場合はfalse
}

// アプリ起動時に呼び出し、発生日を過ぎていて今月分が未生成の定期支出を自動登録する。
// 過去分の遡及生成は行わない（意図しない大量登録を避けるため）。
export const generateDueRecurringExpenses = () => {
  const today = new Date()
  const currentMonth = yearMonth(today)

  const { recurring, updateRecurring } = useRecurringStore.getState()
  const { insertExpense } = useExpenseStore.getState()

  for (const r of recurring) {
    if (!isRecurringDue(r, today)) continue

    const date = `${currentMonth}-${String(targetDayOf(r, today)).padStart(2, '0')}`
    insertExpense({
      id: crypto.randomUUID(),
      amount: r.amount,
      categoryId: r.categoryId,
      itemName: r.name,
      note: '',
      date,
      createdAt: new Date().toISOString(),
    })
    updateRecurring(r.id, { lastGeneratedMonth: currentMonth })
  }
}
