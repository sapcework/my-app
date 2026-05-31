import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react'
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
  const isOver = budget > 0 && total > budget

  const getCat = (id: string) => categories.find((c) => c.id === id)
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">家計簿</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* メインKPIカード */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">今月の支出</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
                ¥{total.toLocaleString()}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{expenses.length}件の取引</p>
            </div>
            {budget > 0 && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isOver
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isOver ? <AlertTriangle size={12} /> : <TrendingUp size={12} />}
                {isOver
                  ? `¥${Math.abs(remaining).toLocaleString()} 超過`
                  : `残り ¥${remaining.toLocaleString()}`}
              </div>
            )}
          </div>

          {budget > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>予算 ¥{budget.toLocaleString()}</span>
                <span>{usageRate.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isOver ? 'bg-rose-500' : usageRate >= 80 ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${usageRate}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 最近の支出 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">最近の支出</h2>
          <button
            onClick={() => navigate('/expenses')}
            className="flex items-center gap-0.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium"
          >
            すべて見る
            <ChevronRight size={14} />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p className="text-sm text-slate-400 dark:text-slate-500">支出がありません</p>
            <button
              onClick={() => navigate('/expenses/new')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
            >
              最初の支出を追加する
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recent.map((e) => {
              const cat = getCat(e.categoryId)
              const title = e.itemName || e.note || cat?.name || '支出'
              return (
                <li
                  key={e.id}
                  onClick={() => navigate(`/expenses/${e.id}/edit`)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer active:bg-slate-100 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '20' }}
                  >
                    {cat?.icon ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: cat?.color ?? '#9E9E9E' }}>
                      {cat?.name ?? '不明'}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDateWithDay(e.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-shrink-0 tabular-nums">
                    ¥{e.amount.toLocaleString()}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {recent.length > 0 && <div className="h-1" />}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/expenses/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-all"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  )
}
