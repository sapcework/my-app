import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Grid3X3 } from 'lucide-react'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useBudgetStore } from '../store/budgetStore'
import { toYearMonth, formatTableMonth, formatDateWithDay, formatYearMonth } from '../utils/date'
import { useModalA11y } from '../hooks/useModalA11y'
import { activatable } from '../utils/interactive'
import type { Category } from '../types'

type CellDetail = {
  catId: string | null
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
  const detailRef = useModalA11y<HTMLDivElement>(detail !== null, () => setDetail(null))

  const currentYear = new Date().getFullYear()
  const currentMonth = toYearMonth(new Date())

  const months: string[] = useMemo(() => {
    const set = new Set([...expenses.map((e) => e.date.substring(0, 7)), currentMonth])
    return [...set].sort().slice(-12)
  }, [expenses, currentMonth])

  // expensesを1回だけ走査し、月×カテゴリの合計をMapに事前集計しておく（O(件数)）
  const monthCatTotals = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const e of expenses) {
      const m = e.date.substring(0, 7)
      if (!map.has(m)) map.set(m, new Map())
      const catMap = map.get(m)!
      catMap.set(e.categoryId, (catMap.get(e.categoryId) ?? 0) + e.amount)
    }
    return map
  }, [expenses])

  const monthTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const [m, catMap] of monthCatTotals) {
      let sum = 0
      for (const v of catMap.values()) sum += v
      map.set(m, sum)
    }
    return map
  }, [monthCatTotals])

  const getAmount = (catId: string, month: string): number =>
    monthCatTotals.get(month)?.get(catId) ?? 0

  const getMonthTotal = (month: string): number =>
    monthTotals.get(month) ?? 0

  const getCatAvg = (catId: string): number => {
    const vals = months.map((m) => getAmount(catId, m)).filter((v) => v > 0)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v) / vals.length) : 0
  }

  const getTotalAvg = (): number => {
    const vals = months.map((m) => getMonthTotal(m)).filter((v) => v > 0)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v) / vals.length) : 0
  }

  const fmt = (n: number): string => (n > 0 ? `¥${n.toLocaleString()}` : '—')

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
      <div className="pt-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight mb-4">月別支出表</h1>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Grid3X3 size={26} className="text-slate-400 dark:text-slate-400" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">支出データがありません</p>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">支出を記録すると月別の集計表が表示されます</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-5 space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">月別支出表</h1>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <table className="border-collapse text-xs" style={{ minWidth: `${88 + months.length * 72 + 72}px` }}>
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/60 text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 border-b border-r border-slate-200/60 dark:border-slate-800 min-w-20">
                分類
              </th>
              {months.map((m) => (
                <th key={m} className="px-2 py-3 text-center font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 min-w-[72px] whitespace-pre-line text-[11px]">
                  {formatTableMonth(m, currentYear)}
                </th>
              ))}
              <th className="px-2 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400 border-b border-l border-slate-200/60 dark:border-slate-800 min-w-[72px] text-[11px] bg-indigo-50/60 dark:bg-indigo-950/30">
                平均
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const avg = getCatAvg(cat.id)
              return (
                <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2.5 border-b border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-16">{cat.icon} {cat.name}</span>
                    </div>
                  </td>
                  {months.map((m) => {
                    const amt = getAmount(cat.id, m)
                    return (
                      <td
                        key={m}
                        onClick={() => amt > 0 && openDetail(cat, m)}
                        onKeyDown={(e) => { if (amt > 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(cat, m) } }}
                        tabIndex={amt > 0 ? 0 : undefined}
                        aria-label={amt > 0 ? `${cat.name} ${formatYearMonth(m)} の明細を表示` : undefined}
                        className={`px-2 py-2.5 text-right border-b border-slate-100 dark:border-slate-800 tabular-nums ${
                          amt > 0
                            ? 'text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 focus-visible:bg-indigo-50 dark:focus-visible:bg-indigo-950/30'
                            : 'text-slate-300 dark:text-slate-500'
                        }`}
                      >
                        {fmt(amt)}
                      </td>
                    )
                  })}
                  <td className={`px-2 py-2.5 text-right border-b border-l border-slate-100 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20 tabular-nums ${
                    avg > 0 ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-300 dark:text-slate-500'
                  }`}>
                    {fmt(avg)}
                  </td>
                </tr>
              )
            })}

            {/* 合計行 */}
            <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold">
              <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/60 px-3 py-3 border-t-2 border-slate-200 dark:border-slate-700 border-r text-[11px] text-slate-700 dark:text-slate-200">
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
                    onKeyDown={(e) => { if (total > 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(null, m) } }}
                    tabIndex={total > 0 ? 0 : undefined}
                    aria-label={total > 0 ? `${formatYearMonth(m)} の合計明細を表示` : undefined}
                    className={`px-2 py-3 text-right border-t-2 border-slate-200 dark:border-slate-700 tabular-nums ${
                      total > 0
                        ? `cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 ${
                            isOver ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'
                          }`
                        : 'text-slate-300 dark:text-slate-500'
                    }`}
                  >
                    {fmt(total)}
                  </td>
                )
              })}
              <td className="px-2 py-3 text-right border-t-2 border-slate-200 dark:border-slate-700 border-l bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 tabular-nums">
                {fmt(getTotalAvg())}
              </td>
            </tr>

            {/* 予算行 */}
            {months.some((m) => getBudget(m) > 0) && (
              <tr className="bg-indigo-50/40 dark:bg-indigo-950/20">
                <td className="sticky left-0 z-10 bg-indigo-50/40 dark:bg-indigo-950/20 px-3 py-2 border-t border-indigo-100 dark:border-indigo-900 border-r text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  予算
                </td>
                {months.map((m) => {
                  const b = getBudget(m)
                  return (
                    <td key={m} className="px-2 py-2 text-right border-t border-indigo-100 dark:border-indigo-900 text-indigo-500 dark:text-indigo-400 tabular-nums">
                      {b > 0 ? `¥${b.toLocaleString()}` : '—'}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-right border-t border-l border-indigo-100 dark:border-indigo-900 bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {(() => {
                    const bs = months.map((m) => getBudget(m)).filter((b) => b > 0)
                    if (!bs.length) return '—'
                    return `¥${Math.round(bs.reduce((s, b) => s + b) / bs.length).toLocaleString()}`
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-400 text-center">直近{months.length}ヶ月 · 金額をタップで詳細</p>

      {/* セル詳細モーダル */}
      {detail && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`${detail.label}の明細`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div ref={detailRef} tabIndex={-1} className="relative bg-white dark:bg-slate-900 rounded-t-3xl max-h-[70vh] flex flex-col max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-bold" style={{ color: detail.color }}>{detail.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                  {formatYearMonth(detail.month)} · {detailExpenses.length}件 ·
                  ¥{detailExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="閉じる"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="overflow-y-auto px-5 py-3 space-y-1 pb-10">
              {detailExpenses.map((e) => {
                const cat = categories.find((c) => c.id === e.categoryId)
                const title = e.itemName || e.note || cat?.name || '支出'
                return (
                  <li
                    key={e.id}
                    {...activatable(() => { setDetail(null); navigate(`/expenses/${e.id}/edit`) }, `${title} を編集`)}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                        style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '20' }}
                      >
                        {cat?.icon ?? '📦'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{formatDateWithDay(e.date)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                      ¥{e.amount.toLocaleString()}
                    </span>
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
