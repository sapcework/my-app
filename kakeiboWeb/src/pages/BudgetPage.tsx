import { useState } from 'react'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useBudgetStore } from '../store/budgetStore'
import { useExpenseStore } from '../store/expenseStore'
import { useUIStore } from '../store/uiStore'
import { formatYearMonth } from '../utils/date'

export const BudgetPage = () => {
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getBudget, setBudget } = useBudgetStore()
  const { getMonthlyExpenses } = useExpenseStore()

  const budget = getBudget(selectedMonth)
  const [input, setInput] = useState(budget > 0 ? budget.toString() : '')

  const total = getMonthlyExpenses(selectedMonth).reduce((s, e) => s + e.amount, 0)
  const remaining = budget - total
  const rate = budget > 0 ? Math.min((total / budget) * 100, 100) : 0

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input) return
    setBudget(selectedMonth, Number(input))
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m)
    const b = getBudget(m)
    setInput(b > 0 ? b.toString() : '')
  }

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">予算設定</h1>
        <MonthSwitcher month={selectedMonth} onChange={handleMonthChange} />
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <p className="text-sm text-gray-500">{formatYearMonth(selectedMonth)}の予算</p>
        <div className="flex items-center border rounded-xl px-3 py-2">
          <span className="text-gray-500 mr-1">¥</span>
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 outline-none text-lg font-semibold"
            placeholder="0"
            min="1"
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">
          保存する
        </button>
      </form>

      {budget > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-sm text-gray-500">今月の進捗</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">支出 ¥{total.toLocaleString()}</span>
            <span className="text-gray-500">予算 ¥{budget.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${rate >= 100 ? 'bg-red-500' : rate >= 80 ? 'bg-yellow-400' : 'bg-blue-500'}`}
              style={{ width: `${rate}%` }}
            />
          </div>
          <p className={`font-semibold ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
            {remaining < 0
              ? `¥${Math.abs(remaining).toLocaleString()} オーバー`
              : `残り ¥${remaining.toLocaleString()}`}
          </p>
        </div>
      )}
    </div>
  )
}
