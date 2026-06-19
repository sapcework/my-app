import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { formatDateWithDay, formatTimestamp } from '../utils/date'
import { downloadCsv } from '../utils/csv'
import { activatable } from '../utils/interactive'
import type { Category } from '../types'

export const StatsPage = () => {
  const navigate = useNavigate()
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getMonthlyExpenses } = useExpenseStore()
  const { categories } = useCategoryStore()
  const [detailCat, setDetailCat] = useState<Category | null>(null)

  const monthExpenses = getMonthlyExpenses(selectedMonth)
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0)

  const data = categories
    .map((cat) => ({
      cat,
      name: `${cat.icon} ${cat.name}`,
      value: monthExpenses.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
      color: cat.color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const exportCSV = () => {
    const rows = [
      ['日付', 'カテゴリ', '項目名', 'メモ', '金額', '登録日時', '更新日時'],
      ...monthExpenses
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const cat = categories.find((c) => c.id === e.categoryId)
          return [
            e.date,
            cat?.name ?? '不明',
            e.itemName ?? '',
            e.note ?? '',
            e.amount.toString(),
            formatTimestamp(e.createdAt),
            formatTimestamp(e.updatedAt),
          ]
        }),
    ]
    downloadCsv(rows, `kakeibo_${selectedMonth}.csv`)
  }

  const detailExpenses = detailCat
    ? monthExpenses.filter((e) => e.categoryId === detailCat.id).sort((a, b) => b.date.localeCompare(a.date))
    : []

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">統計</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-slate-400 dark:text-slate-400">支出がありません</p>
        </div>
      ) : (
        <>
          {/* 合計 + CSV */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1">今月の合計</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
                ¥{total.toLocaleString()}
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3.5 py-2.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <Download size={14} />
              CSV出力
            </button>
          </div>

          {/* パイチャート */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  innerRadius={40}
                  onClick={(d) => setDetailCat((d as unknown as { cat: Category }).cat)}
                  className="cursor-pointer"
                  paddingAngle={2}
                >
                  {data.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => typeof v === 'number' ? `¥${v.toLocaleString()}` : v}
                  contentStyle={{
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 dark:text-slate-400 text-center">カテゴリをタップで詳細表示</p>
          </div>

          {/* カテゴリ別リスト */}
          <ul className="space-y-2">
            {data.map((d, i) => (
              <li
                key={i}
                {...activatable(() => setDetailCat(d.cat), `${d.cat.name} の明細を表示`)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: d.color + '20' }}
                  >
                    {d.cat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{d.cat.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-400">{((d.value / total) * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    ¥{d.value.toLocaleString()}
                  </p>
                  <span className="text-slate-300 dark:text-slate-500 text-sm">›</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* カテゴリ詳細モーダル */}
      {detailCat && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailCat(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl max-h-[75vh] flex flex-col max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: detailCat.color + '20' }}
                >
                  {detailCat.icon}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: detailCat.color }}>{detailCat.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-400">
                    {detailExpenses.length}件 · ¥{detailExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailCat(null)}
                aria-label="閉じる"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="overflow-y-auto px-5 py-3 space-y-1 pb-10">
              {detailExpenses.map((e) => {
                const title = e.itemName || e.note || detailCat.name
                return (
                  <li
                    key={e.id}
                    {...activatable(() => { setDetailCat(null); navigate(`/expenses/${e.id}/edit`) }, `${title} を編集`)}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-2 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{formatDateWithDay(e.date)}</p>
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
