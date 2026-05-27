import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useBudgetStore } from '../store/budgetStore'
import { toYearMonth, formatTableMonth, formatDateWithDay, formatYearMonth } from '../utils/date'
import type { Category } from '../types'

type CellDetail = {
  catId: string | null   // null = 合計行
  month: string
  label: string
  color: string
}

export const TablePage = () => {
  const navigate = useNavigate()
  const { expenses } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { getBudget } = useBudgetStore()
  const [detail, setDetail] = useState<CellDetail | null>(null)

  const currentYear = new Date().getFullYear()
  const currentMonth = toYearMonth(new Date())

  const months: string[] = (() => {
    const set = new Set([...expenses.map((e) => e.date.substring(0, 7)), currentMonth])
    return [...set].sort().slice(-12)
  })()

  const getAmount = (catId: string, month: string): number =>
    expenses.filter((e) => e.categoryId === catId && e.date.startsWith(month))
      .reduce((s, e) => s + e.amount, 0)

  const getMonthTotal = (month: string): number =>
    expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0)

  const getCatAvg = (catId: string): number => {
    const vals = months.map((m) => getAmount(catId, m)).filter((v) => v > 0)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v) / vals.length) : 0
  }

  const getTotalAvg = (): number => {
    const vals = months.map((m) => getMonthTotal(m)).filter((v) => v > 0)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v) / vals.length) : 0
  }

  const fmt = (n: number): string => (n > 0 ? `¥${n.toLocaleString()}` : '---')

  const openDetail = (cat: Category | null, month: string) => {
    setDetail({
      catId: cat?.id ?? null,
      month,
      label: cat ? `${cat.icon} ${cat.name}` : '合計',
      color: cat?.color ?? '#374151',
    })
  }

  const detailExpenses = detail
    ? expenses
        .filter((e) =>
          e.date.startsWith(detail.month) &&
          (detail.catId === null || e.categoryId === detail.catId)
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    : []

  if (expenses.length === 0) {
    return (
      <div className="pt-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">月別支出表</h1>
        <div className="text-center py-16 text-gray-400">支出データがありません</div>
      </div>
    )
  }

  return (
    <div className="pt-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">月別支出表</h1>

      <div className="overflow-x-auto rounded-2xl shadow-sm bg-white">
        <table className="border-collapse text-sm" style={{ minWidth: `${80 + months.length * 72 + 72}px` }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-600 border-b border-r border-gray-200 min-w-20">
                分類
              </th>
              {months.map((m) => (
                <th key={m} className="px-2 py-3 text-center font-semibold text-gray-600 border-b border-gray-200 min-w-18 whitespace-pre-line text-xs">
                  {formatTableMonth(m, currentYear)}
                </th>
              ))}
              <th className="px-2 py-3 text-center font-semibold text-blue-600 border-b border-l border-gray-200 min-w-18 text-xs bg-blue-50">
                平均
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => {
              const avg = getCatAvg(cat.id)
              const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              return (
                <tr key={cat.id} className={rowBg}>
                  <td className={`sticky left-0 z-10 px-3 py-2.5 border-b border-r border-gray-100 ${rowBg}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-gray-700 truncate max-w-16">{cat.icon} {cat.name}</span>
                    </div>
                  </td>
                  {months.map((m) => {
                    const amt = getAmount(cat.id, m)
                    return (
                      <td
                        key={m}
                        onClick={() => amt > 0 && openDetail(cat, m)}
                        className={`px-2 py-2.5 text-right border-b border-gray-100 text-xs ${
                          amt > 0 ? 'text-gray-800 cursor-pointer hover:bg-blue-50' : 'text-gray-300'
                        }`}
                      >
                        {fmt(amt)}
                      </td>
                    )
                  })}
                  <td className={`px-2 py-2.5 text-right border-b border-l border-gray-100 text-xs bg-blue-50/50 ${avg > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                    {fmt(avg)}
                  </td>
                </tr>
              )
            })}

            {/* 合計行 */}
            <tr className="bg-gray-100 font-semibold">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-3 border-t-2 border-gray-300 border-r text-xs text-gray-800">
                合計
              </td>
              {months.map((m) => {
                const total = getMonthTotal(m)
                const budget = getBudget(m)
                const isOver = budget > 0 && total > budget
                return (
                  <td
                    key={m}
                    onClick={() => total > 0 && openDetail(null, m)}
                    className={`px-2 py-3 text-right border-t-2 border-gray-300 text-xs ${
                      total > 0 ? `cursor-pointer hover:bg-blue-50 ${isOver ? 'text-red-600' : 'text-gray-800'}` : 'text-gray-300'
                    }`}
                  >
                    {fmt(total)}
                  </td>
                )
              })}
              <td className="px-2 py-3 text-right border-t-2 border-gray-300 border-l text-xs bg-blue-100 text-blue-800">
                {fmt(getTotalAvg())}
              </td>
            </tr>

            {/* 予算行 */}
            {months.some((m) => getBudget(m) > 0) && (
              <tr className="bg-blue-50">
                <td className="sticky left-0 z-10 bg-blue-50 px-3 py-2 border-t border-blue-200 border-r text-xs text-blue-700 font-medium">
                  予算
                </td>
                {months.map((m) => {
                  const b = getBudget(m)
                  return (
                    <td key={m} className="px-2 py-2 text-right border-t border-blue-200 text-xs text-blue-600">
                      {b > 0 ? `¥${b.toLocaleString()}` : '---'}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-right border-t border-l border-blue-200 text-xs bg-blue-100 text-blue-700">
                  {(() => {
                    const bs = months.map((m) => getBudget(m)).filter((b) => b > 0)
                    if (!bs.length) return '---'
                    return `¥${Math.round(bs.reduce((s, b) => s + b) / bs.length).toLocaleString()}`
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 text-center">直近{months.length}ヶ月 · 金額をタップで詳細</p>

      {/* セル詳細モーダル */}
      {detail && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetail(null)} />
          <div className="relative bg-white rounded-t-3xl max-h-[70vh] flex flex-col max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-800" style={{ color: detail.color }}>{detail.label}</p>
                <p className="text-xs text-gray-400">
                  {formatYearMonth(detail.month)} · {detailExpenses.length}件 ·
                  ¥{detailExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <ul className="overflow-y-auto px-5 py-3 space-y-2 pb-8">
              {detailExpenses.map((e) => {
                const cat = categories.find((c) => c.id === e.categoryId)
                const title = e.itemName || e.note || cat?.name || '支出'
                return (
                  <li
                    key={e.id}
                    onClick={() => { setDetail(null); navigate(`/expenses/${e.id}/edit`) }}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 rounded-xl px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                        style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '22' }}
                      >
                        {cat?.icon ?? '📦'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{title}</p>
                        <p className="text-xs text-gray-400">{formatDateWithDay(e.date)}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-gray-800">¥{e.amount.toLocaleString()}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
