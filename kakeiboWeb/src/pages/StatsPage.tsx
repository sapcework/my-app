import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { formatDateWithDay } from '../utils/date'
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
      ['日付', 'カテゴリ', '項目名', 'メモ', '金額'],
      ...monthExpenses
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const cat = categories.find((c) => c.id === e.categoryId)
          return [e.date, cat?.name ?? '不明', e.itemName ?? '', e.note ?? '', e.amount.toString()]
        }),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kakeibo_${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const detailExpenses = detailCat
    ? monthExpenses.filter((e) => e.categoryId === detailCat.id).sort((a, b) => b.date.localeCompare(a.date))
    : []

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">統計</h1>
        <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {total === 0 ? (
        <div className="text-center py-12 text-gray-400">支出がありません</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm p-5 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 mb-1">今月の合計</p>
              <p className="text-2xl font-bold text-gray-800">¥{total.toLocaleString()}</p>
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100"
            >
              <span>📥</span>
              <span>CSV出力</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  onClick={(d) => setDetailCat((d as unknown as { cat: Category }).cat)}
                  className="cursor-pointer"
                >
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => typeof v === 'number' ? `¥${v.toLocaleString()}` : v} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 text-center mt-1">カテゴリをタップで詳細表示</p>
          </div>

          <ul className="space-y-2">
            {data.map((d, i) => (
              <li
                key={i}
                onClick={() => setDetailCat(d.cat)}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: d.color + '22' }}
                  >
                    {d.cat.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">{d.cat.name}</p>
                    <p className="text-xs text-gray-400">{((d.value / total) * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">¥{d.value.toLocaleString()}</p>
                  <span className="text-gray-300">›</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* カテゴリ詳細モーダル */}
      {detailCat && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailCat(null)} />
          <div className="relative bg-white rounded-t-3xl max-h-[75vh] flex flex-col max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: detailCat.color + '22' }}
                >
                  {detailCat.icon}
                </span>
                <div>
                  <p className="font-bold" style={{ color: detailCat.color }}>{detailCat.name}</p>
                  <p className="text-xs text-gray-400">
                    {detailExpenses.length}件 ·
                    ¥{detailExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailCat(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <ul className="overflow-y-auto px-5 py-3 space-y-2 pb-8">
              {detailExpenses.map((e) => {
                const title = e.itemName || e.note || detailCat.name
                return (
                  <li
                    key={e.id}
                    onClick={() => { setDetailCat(null); navigate(`/expenses/${e.id}/edit`) }}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 rounded-xl px-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{title}</p>
                      <p className="text-xs text-gray-400">{formatDateWithDay(e.date)}</p>
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
