import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Upload, Tag, Wallet, Repeat2, FileText, Table } from 'lucide-react'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useBudgetStore } from '../store/budgetStore'
import { useRecurringStore } from '../store/recurringStore'
import type { Expense, Category, Budget, RecurringExpense } from '../types'

type BackupData = {
  version: string
  exportedAt: string
  expenses: Expense[]
  categories: Category[]
  budgets: Budget[]
  recurring: RecurringExpense[]
}

const downloadCsv = (rows: string[][], filename: string) => {
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const fmtTs = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export const SettingsPage = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { expenses, restoreExpenses } = useExpenseStore()
  const { categories, restoreCategories } = useCategoryStore()
  const { budgets, restoreBudgets } = useBudgetStore()
  const { recurring, restoreRecurring } = useRecurringStore()

  const handleBackup = () => {
    const data: BackupData = {
      version: '1',
      exportedAt: new Date().toISOString(),
      expenses,
      categories,
      budgets,
      recurring,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData
        if (!Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
          alert('無効なバックアップファイルです。')
          return
        }
        if (!confirm('現在のすべてのデータが上書きされます。復元しますか？')) return
        restoreExpenses(data.expenses)
        restoreCategories(data.categories)
        restoreBudgets(data.budgets ?? [])
        restoreRecurring(data.recurring ?? [])
        alert('復元が完了しました。')
      } catch {
        alert('バックアップファイルの読み込みに失敗しました。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 全年月の明細CSV
  const exportAllDetails = () => {
    if (expenses.length === 0) { alert('支出データがありません。'); return }
    const rows: string[][] = [
      ['日付', 'カテゴリ', '項目名', 'メモ', '金額', '登録日時', '更新日時'],
      ...expenses
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
            fmtTs(e.createdAt),
            fmtTs(e.updatedAt),
          ]
        }),
    ]
    downloadCsv(rows, `kakeibo_all_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // 月別支出表CSV（行=年月、列=カテゴリ）
  const exportMonthlyTable = () => {
    if (expenses.length === 0) { alert('支出データがありません。'); return }
    const months = [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort()
    const usedCatIds = [...new Set(expenses.map((e) => e.categoryId))]
    const cols = categories.filter((c) => usedCatIds.includes(c.id))
    const header = ['年月', ...cols.map((c) => c.name), '合計']
    const dataRows = months.map((month) => {
      const mes = expenses.filter((e) => e.date.startsWith(month))
      const catTotals = cols.map((cat) =>
        mes.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0).toString()
      )
      const total = mes.reduce((s, e) => s + e.amount, 0).toString()
      return [month, ...catTotals, total]
    })
    downloadCsv([header, ...dataRows], `kakeibo_monthly_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const menuItems = [
    { label: 'カテゴリ', icon: Tag, path: '/categories', desc: `${categories.length}件` },
    { label: '予算設定', icon: Wallet, path: '/budget', desc: '月別予算の管理' },
    { label: '定期支出', icon: Repeat2, path: '/recurring', desc: `${recurring.length}件` },
  ]

  return (
    <div className="pt-5 space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">設定</h1>

      {/* データ管理 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-5 pt-4 pb-2">
          データ管理
        </p>

        <button
          onClick={handleBackup}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800/80"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
            <Download size={17} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">バックアップ</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">全データをJSONファイルに書き出す</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800/80"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
            <Upload size={17} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">復元</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">バックアップファイルから復元する</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </button>

        <button
          onClick={exportAllDetails}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800/80"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
            <FileText size={17} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">全明細CSV出力</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">全年月の支出明細を1ファイルに出力</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </button>

        <button
          onClick={exportMonthlyTable}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800/80"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
            <Table size={17} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">月別支出表CSV出力</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">行=年月・列=カテゴリの集計表を出力</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleRestoreFile}
        />
      </div>

      {/* 管理メニュー */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-5 pt-4 pb-2">
          管理
        </p>
        {menuItems.map(({ label, icon: Icon, path, desc }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800/80"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Icon size={17} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
          </button>
        ))}
      </div>

      {/* バージョン情報 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-5 pt-4 pb-2">
          バージョン情報
        </p>
        <div className="px-5 pt-3 pb-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
              <span className="text-2xl">📒</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">家計簿</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">シンプルな支出管理アプリ</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'バージョン', value: '1.0.0' },
              { label: 'ビルド', value: '2025.05' },
              { label: 'プラットフォーム', value: 'Web (PWA対応)' },
              { label: 'データ保存', value: 'ローカルストレージ' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300 dark:text-slate-600 text-center mt-4">
            © 2025 Kakeibo App. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
