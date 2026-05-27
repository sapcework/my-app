import { useNavigate } from 'react-router-dom'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useExpenseStore } from '../store/expenseStore'
import { useBudgetStore } from '../store/budgetStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { formatDateWithDay } from '../utils/date'

export const HomePage = () => {
  const navigate = useNavigate()
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getMonthlyExpenses } = useExpenseStore()
  const { getBudget } = useBudgetStore()
  const { categories } = useCategoryStore()

  const expenses = getMonthlyExpenses(selectedMonth)
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const budget = getBudget(selectedMonth)
  const remaining = budget - total
  const usageRate = budget > 0 ? Math.min((total / budget) * 100, 100) : 0

  const getCat = (id: string) => categories.find((c) => c.id === id)
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">家計簿</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* サマリーカード */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{expenses.length}件の支出</span>
          {budget > 0 && <span>予算 ¥{budget.toLocaleString()}</span>}
        </div>
        <p className="text-3xl font-bold text-gray-800">¥{total.toLocaleString()}</p>
        {budget > 0 && (
          <>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usageRate >= 100 ? 'bg-red-500' : usageRate >= 80 ? 'bg-yellow-400' : 'bg-blue-500'
                }`}
                style={{ width: `${usageRate}%` }}
              />
            </div>
            <p className={`text-sm font-medium ${remaining < 0 ? 'text-red-500' : 'text-gray-600'}`}>
              {remaining < 0
                ? `¥${Math.abs(remaining).toLocaleString()} 超過`
                : `残り ¥${remaining.toLocaleString()}`}
            </p>
          </>
        )}
      </div>

      {/* 最近の支出 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">最近の支出</h2>
          <button onClick={() => navigate('/expenses')} className="text-sm text-blue-500">
            すべて見る
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">支出がありません</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((e) => {
              const cat = getCat(e.categoryId)
              const title = e.itemName || e.note || cat?.name || '支出'
              return (
                <li
                  key={e.id}
                  onClick={() => navigate(`/expenses/${e.id}/edit`)}
                  className="flex items-center justify-between py-2 px-1 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '22' }}
                    >
                      {cat?.icon ?? '📦'}
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: cat?.color ?? '#9E9E9E' }}>
                        {cat?.name ?? '不明'}
                      </p>
                      <p className="text-sm text-gray-700">{title}</p>
                      <p className="text-xs text-gray-400">{formatDateWithDay(e.date)}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-800 flex-shrink-0 ml-2">
                    ¥{e.amount.toLocaleString()}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button
        onClick={() => navigate('/expenses/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-blue-700"
      >
        +
      </button>
    </div>
  )
}
