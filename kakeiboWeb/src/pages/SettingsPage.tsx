import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Upload, Tag, Wallet, Repeat2, FileText, Table, Sun, Moon, Monitor, Lock, Unlock, X, LogOut } from 'lucide-react'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useBudgetStore } from '../store/budgetStore'
import { useRecurringStore } from '../store/recurringStore'
import { dbRestoreAll } from '../lib/db'
import { downloadCsv, expenseDetailRows } from '../utils/csv'
import { confirmDialog } from '../store/dialogStore'
import { showToast } from '../store/toastStore'
import { useThemeStore } from '../store/themeStore'
import { usePasscodeStore } from '../store/passcodeStore'
import { PinPad } from '../components/PinPad'
import { useAuthStore } from '../store/authStore'
import { useModalA11y } from '../hooks/useModalA11y'
import type { Expense, Category, Budget, RecurringExpense } from '../types/index'

type BackupData = {
  version: string
  exportedAt: string
  expenses: Expense[]
  categories: Category[]
  budgets: Budget[]
  recurring: RecurringExpense[]
}

export const SettingsPage = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { theme, setTheme } = useThemeStore()
  const { enabled: passcodeEnabled, setPasscode, removePasscode, verify } = usePasscodeStore()
  const [pinSheet, setPinSheet] = useState<'setup1' | 'setup2' | 'disable' | null>(null)
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState(false)

  const closePinSheet = () => { setPinSheet(null); setFirstPin(''); setPinError(false) }
  const pinSheetRef = useModalA11y<HTMLDivElement>(pinSheet !== null, closePinSheet)

  const handleSetup1 = (pin: string) => { setFirstPin(pin); setPinSheet('setup2') }

  const handleSetup2 = async (pin: string) => {
    if (pin !== firstPin) { setPinError(true); return }
    await setPasscode(pin)
    closePinSheet()
    showToast({ message: 'パスコードを設定しました' })
  }

  const handleDisable = async (pin: string) => {
    const ok = await verify(pin)
    if (!ok) { setPinError(true); return }
    removePasscode()
    closePinSheet()
    showToast({ message: 'パスコードを解除しました' })
  }
  const { expenses, restoreExpenses } = useExpenseStore()
  const { categories, restoreCategories } = useCategoryStore()
  const { budgets, restoreBudgets } = useBudgetStore()
  const { recurring, restoreRecurring } = useRecurringStore()

  const handleBackup = async () => {
    const filename = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json` // 書き出すファイル名
    const ok = await confirmDialog({
      title: 'バックアップ',
      message: `「${filename}」として全データを書き出します。よろしいですか？`,
      confirmLabel: '書き出す',
    })
    if (!ok) return // 書き出し前の確認
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
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    showToast({ message: 'バックアップを書き出しました' })
  }

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData
        if (!Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
          showToast({ message: '無効なバックアップファイルです' })
          return
        }
        const ok = await confirmDialog({
          title: 'バックアップから復元',
          message: `${file.name} で復元してもよろしいですか？\n現在のデータはすべて上書きされます。`,
          confirmLabel: '復元する',
          danger: true, // 上書きは破壊的操作
        })
        if (!ok) return
        // クラウドへの反映が成功してからローカルに適用する（クラウドを正とするため）
        const { error } = await dbRestoreAll({
          expenses: data.expenses,
          categories: data.categories,
          budgets: data.budgets ?? [],
          recurring: data.recurring ?? [],
        })
        if (error) {
          console.error('dbRestoreAll failed', error)
          showToast({ message: '復元に失敗しました。通信状況を確認してもう一度お試しください' })
          return
        }
        restoreExpenses(data.expenses)
        restoreCategories(data.categories)
        restoreBudgets(data.budgets ?? [])
        restoreRecurring(data.recurring ?? [])
        showToast({ message: '復元が完了しました' })
      } catch {
        showToast({ message: 'バックアップファイルの読み込みに失敗しました' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 全年月の明細CSV
  const exportAllDetails = async () => {
    if (expenses.length === 0) { showToast({ message: '支出データがありません' }); return }
    const filename = `kakeibo_all_${new Date().toISOString().slice(0, 10)}.csv` // 出力するファイル名
    const ok = await confirmDialog({
      title: '全明細CSV出力',
      message: `「${filename}」として全期間の支出明細を書き出します。よろしいですか？`,
      confirmLabel: '書き出す',
    })
    if (!ok) return // 出力前の確認
    downloadCsv(expenseDetailRows(expenses, categories), filename)
    showToast({ message: 'CSVを書き出しました' })
  }

  // 月別支出表CSV（行=年月、列=カテゴリ）
  const exportMonthlyTable = async () => {
    if (expenses.length === 0) { showToast({ message: '支出データがありません' }); return }
    const filename = `kakeibo_monthly_${new Date().toISOString().slice(0, 10)}.csv` // 出力するファイル名
    const ok = await confirmDialog({
      title: '月別支出表CSV出力',
      message: `「${filename}」として月別支出表を書き出します。よろしいですか？`,
      confirmLabel: '書き出す',
    })
    if (!ok) return // 出力前の確認
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
    downloadCsv([header, ...dataRows], filename)
    showToast({ message: 'CSVを書き出しました' })
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider px-5 pt-4 pb-2">
          データ管理
        </p>

        <button
          onClick={handleBackup}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
            <Download size={17} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">バックアップ</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">全データをJSONファイルに書き出す</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-500" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
            <Upload size={17} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">復元</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">バックアップファイルから復元する</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-500" />
        </button>

        <button
          onClick={exportAllDetails}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
            <FileText size={17} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">全明細CSV出力</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">全年月の支出明細を1ファイルに出力</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-500" />
        </button>

        <button
          onClick={exportMonthlyTable}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
            <Table size={17} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">月別支出表CSV出力</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">行=年月・列=カテゴリの集計表を出力</p>
          </div>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-500" />
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider px-5 pt-4 pb-2">
          管理
        </p>
        {menuItems.map(({ label, icon: Icon, path, desc }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Icon size={17} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 dark:text-slate-500" />
          </button>
        ))}
      </div>

      {/* セキュリティ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider px-5 pt-4 pb-2">
          セキュリティ
        </p>
        <button
          onClick={() => setPinSheet(passcodeEnabled ? 'disable' : 'setup1')}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            passcodeEnabled ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            {passcodeEnabled
              ? <Lock size={17} className="text-indigo-600 dark:text-indigo-400" />
              : <Unlock size={17} className="text-slate-500 dark:text-slate-400" />}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">パスコードロック</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">
              {passcodeEnabled ? '有効 — タップして解除' : '無効 — タップして設定'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            passcodeEnabled
              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            {passcodeEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* パスコード設定モーダル */}
      {pinSheet && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="パスコード設定">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePinSheet} />
          <div ref={pinSheetRef} tabIndex={-1} className="relative bg-white dark:bg-slate-900 rounded-3xl px-8 pt-8 pb-10 w-full max-w-sm shadow-xl">
            <button
              onClick={closePinSheet}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
            {pinSheet === 'setup1' && (
              <PinPad title="新しいパスコードを入力" onComplete={handleSetup1} compact />
            )}
            {pinSheet === 'setup2' && (
              <PinPad
                title="もう一度入力して確認"
                onComplete={handleSetup2}
                error={pinError}
                onErrorReset={() => setPinError(false)}
                compact
              />
            )}
            {pinSheet === 'disable' && (
              <PinPad
                title="現在のパスコードを入力"
                onComplete={handleDisable}
                error={pinError}
                onErrorReset={() => setPinError(false)}
                compact
              />
            )}
          </div>
        </div>
      )}

      {/* 外観 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">外観</p>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          {([
            { value: 'light', label: 'ライト', icon: Sun },
            { value: 'system', label: 'システム', icon: Monitor },
            { value: 'dark', label: 'ダーク', icon: Moon },
          ] as const).map(({ value, label, icon: Icon }, i) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                i > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''
              } ${
                theme === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* アカウント */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider px-5 pt-4 pb-2">
          アカウント
        </p>
        <button
          onClick={async () => {
            const ok = await confirmDialog({ title: 'ログアウト', message: 'ログアウトしますか？', confirmLabel: 'ログアウト', danger: true })
            if (ok) useAuthStore.getState().signOut()
          }}
          className="w-full flex items-center gap-4 px-5 py-4 border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center flex-shrink-0">
            <LogOut size={16} className="text-rose-500" />
          </div>
          <span className="text-sm font-medium text-rose-500">ログアウト</span>
        </button>
      </div>

      {/* バージョン情報 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider px-5 pt-4 pb-2">
          バージョン情報
        </p>
        <div className="px-5 pt-3 pb-5 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
              <span className="text-2xl">📒</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">家計簿</p>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">シンプルな支出管理アプリ</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'バージョン', value: '1.0.0' },
              { label: 'ビルド', value: '2025.05' },
              { label: 'プラットフォーム', value: 'Web (PWA対応)' },
              { label: 'データ保存', value: 'Supabase（クラウド）' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300 dark:text-slate-500 text-center mt-4">
            © 2025 Kakeibo App. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
