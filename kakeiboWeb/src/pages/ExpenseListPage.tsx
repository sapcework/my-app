import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { formatDateWithDay } from '../utils/date'

export const ExpenseListPage = () => {
  const navigate = useNavigate()
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getMonthlyExpenses, deleteExpense } = useExpenseStore()
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

  return (
    <div className="pt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">支出一覧</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* 検索バー */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full bg-white rounded-xl pl-8 pr-4 py-2.5 text-sm border border-gray-200 outline-none focus:border-blue-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            ✕
          </button>
        )}
      </div>

      {/* カテゴリフィルターチップ */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        <button
          onClick={() => setFilterCatId(null)}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 font-medium transition-colors ${
            !filterCatId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCatId(filterCatId === c.id ? null : c.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 font-medium transition-colors ${
              filterCatId === c.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={filterCatId === c.id ? { backgroundColor: c.color } : {}}
          >
            <span>{c.icon}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      {/* 件数・合計 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center">
        <span className="text-gray-500 text-sm">{filtered.length}件</span>
        <span className="text-xl font-bold text-gray-800">¥{total.toLocaleString()}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {allExpenses.length === 0 ? '支出がありません' : '該当する支出がありません'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const cat = getCat(e.categoryId)
            const title = e.itemName || e.note || cat?.name || '支出'
            return (
              <li
                key={e.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center"
              >
                <div
                  className="w-1 self-stretch rounded-full mr-3 flex-shrink-0"
                  style={{ backgroundColor: cat?.color ?? '#9E9E9E' }}
                />
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/expenses/${e.id}/edit`)}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '22' }}
                  >
                    {cat?.icon ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: cat?.color ?? '#9E9E9E' }}>
                      {cat?.name ?? '不明'}
                    </p>
                    <p className="text-sm text-gray-700 truncate">{title}</p>
                    <p className="text-xs text-gray-400">{formatDateWithDay(e.date)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span className="font-semibold text-gray-800">¥{e.amount.toLocaleString()}</span>
                  <button
                    onClick={() => { if (confirm('削除しますか？')) deleteExpense(e.id) }}
                    className="text-red-400 text-xs hover:text-red-600"
                  >
                    削除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button
        onClick={() => navigate('/expenses/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-blue-700"
      >
        +
      </button>
    </div>
  )
}
