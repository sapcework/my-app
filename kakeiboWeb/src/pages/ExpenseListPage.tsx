import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Plus, Trash2, Receipt, SearchX } from 'lucide-react'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { formatDateWithDay } from '../utils/date'
import { activatable } from '../utils/interactive'
import { showToast } from '../store/toastStore'
import type { Expense } from '../types'

type DayGroup = { date: string; items: Expense[] }

export const ExpenseListPage = () => {
  const navigate = useNavigate()
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getMonthlyExpenses, deleteExpense, insertExpense } = useExpenseStore()
  const { categories } = useCategoryStore()

  const [search, setSearch] = useState('')
  const [filterCatId, setFilterCatId] = useState<string | null>(null)

  const allExpenses = getMonthlyExpenses(selectedMonth).sort((a, b) => b.date.localeCompare(a.date))

  const filtered = allExpenses.filter((e) => {
    const matchCat = !filterCatId || e.categoryId === filterCatId
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      (e.itemName?.toLowerCase().includes(q) ?? false) ||
      e.note.toLowerCase().includes(q) ||
      e.amount.toString().includes(q)
    return matchCat && matchSearch
  })

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)
  const getCat = (id: string) => categories.find((c) => c.id === id)

  // 日付ごとにグループ化（filtered はすでに日付降順）
  const groupedDays = filtered.reduce<DayGroup[]>((acc, e) => {
    const last = acc[acc.length - 1]
    if (last?.date === e.date) {
      last.items.push(e)
    } else {
      acc.push({ date: e.date, items: [e] })
    }
    return acc
  }, [])

  return (
    <div className="pt-5 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">支出一覧</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* 検索バー */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full bg-white dark:bg-slate-900 rounded-xl pl-9 pr-9 py-2.5 text-sm border border-slate-200/60 dark:border-slate-700/60 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all placeholder:text-slate-400 dark:text-slate-200"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="検索をクリア"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* カテゴリフィルターチップ */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        <button
          onClick={() => setFilterCatId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
            !filterCatId
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50'
          }`}
        >
          すべて
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCatId(filterCatId === c.id ? null : c.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors border ${
              filterCatId === c.id
                ? 'text-white border-transparent'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50'
            }`}
            style={filterCatId === c.id ? { backgroundColor: c.color } : {}}
          >
            <span className="text-sm">{c.icon}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      {/* 件数・合計 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 px-4 py-3 flex justify-between items-center">
        <span className="text-xs text-slate-400 dark:text-slate-400 font-medium">{filtered.length}件</span>
        <span className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight">
          ¥{total.toLocaleString()}
        </span>
      </div>

      {/* リスト（日付グループ） */}
      {filtered.length === 0 ? (
        allExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Receipt size={26} className="text-slate-400 dark:text-slate-400" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">支出がありません</p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">この月の支出を記録しましょう</p>
            </div>
            <button
              onClick={() => navigate('/expenses/new')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1"
            >
              最初の支出を追加する
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <SearchX size={26} className="text-slate-400 dark:text-slate-400" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">該当する支出がありません</p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">検索条件を変えてみてください</p>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {groupedDays.map(({ date, items }) => {
            const dayTotal = items.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={date} className="space-y-1.5">
                {/* 日付ヘッダー（帯型） */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatDateWithDay(date)}
                  </span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    ¥{dayTotal.toLocaleString()}
                  </span>
                </div>
                {/* その日の支出 */}
                <ul className="space-y-1.5">
                  {items.map((e) => {
                    const cat = getCat(e.categoryId)
                    const title = e.itemName || e.note || cat?.name || '支出'
                    return (
                      <li
                        key={e.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center overflow-hidden"
                      >
                        <div
                          className="w-1 self-stretch flex-shrink-0"
                          style={{ backgroundColor: cat?.color ?? '#9E9E9E' }}
                        />
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 transition-colors"
                          {...activatable(() => navigate(`/expenses/${e.id}/edit`), `${title} を編集`)}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '20' }}
                          >
                            {cat?.icon ?? '📦'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: cat?.color ?? '#9E9E9E' }}>
                              {cat?.name ?? '不明'}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{title}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-3.5 py-3">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                            ¥{e.amount.toLocaleString()}
                          </span>
                          <button
                            onClick={() => { deleteExpense(e.id); showToast({ message: '削除しました', actionLabel: '元に戻す', onAction: () => insertExpense(e) }) }}
                            aria-label={`${title} を削除`}
                            className="text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/expenses/new')}
        aria-label="支出を追加"
        className="fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-all"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  )
}
