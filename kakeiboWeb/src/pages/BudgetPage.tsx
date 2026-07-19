import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, AlertTriangle, Calculator as CalcIcon } from 'lucide-react'
import { Calculator } from '../components/Calculator'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useBudgetStore } from '../store/budgetStore'
import { useExpenseStore } from '../store/expenseStore'
import { useUIStore } from '../store/uiStore'
import { formatYearMonth } from '../utils/date'
import { showToast } from '../store/toastStore'

export const BudgetPage = () => {
  const navigate = useNavigate()
  const { selectedMonth, setSelectedMonth } = useUIStore()
  const { getBudget, setBudget } = useBudgetStore()
  const { getMonthlyExpenses } = useExpenseStore()

  const savedBudget = getBudget(selectedMonth) // ストアに保存済みの予算
  const [amount, setAmount] = useState(savedBudget > 0 ? savedBudget : 0)
  const [amountText, setAmountText] = useState(savedBudget > 0 ? savedBudget.toString() : '')
  const [showCalc, setShowCalc] = useState(false)

  const total = getMonthlyExpenses(selectedMonth).reduce((s, e) => s + e.amount, 0)
  const remaining = savedBudget - total
  const rate = savedBudget > 0 ? Math.min((total / savedBudget) * 100, 100) : 0
  const isOver = savedBudget > 0 && total > savedBudget

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return
    setBudget(selectedMonth, amount)
    showToast({ message: `${formatYearMonth(selectedMonth)}の予算を保存しました` })
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m)
    const b = getBudget(m)
    setAmount(b > 0 ? b : 0)
    setAmountText(b > 0 ? b.toString() : '')
  }

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/settings')}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">予算設定</h1>
        </div>
        <MonthSwitcher month={selectedMonth} onChange={handleMonthChange} />
      </div>

      {/* 予算入力フォーム */}
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 space-y-4"
      >
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">
            {formatYearMonth(selectedMonth)}の予算
          </p>
          <div className={`w-full flex items-center gap-2 border rounded-xl px-4 py-3 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/15 ${
              amount > 0
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}>
            <span className="text-slate-400 text-sm flex-shrink-0">¥</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '')
                setAmountText(raw)
                setAmount(raw ? Number(raw) : 0)
              }}
              placeholder="0"
              className="flex-1 text-2xl font-bold tracking-tight tabular-nums bg-transparent outline-none text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-600 min-w-0"
            />
            <button
              type="button"
              onClick={() => setShowCalc(true)}
              aria-label="電卓を開く"
              className="flex-shrink-0 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-0.5"
            >
              <CalcIcon size={16} />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={amount === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20"
        >
          保存する
        </button>
      </form>

      {/* 進捗カード */}
      {savedBudget > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 space-y-4">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider">今月の進捗</p>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-1">支出</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight">
                ¥{total.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-1">予算</p>
              <p className="text-lg font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                ¥{savedBudget.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-400">
              <span>{rate.toFixed(0)}% 使用</span>
              <span>残り ¥{Math.max(0, remaining).toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${
                  isOver ? 'bg-rose-500' : rate >= 80 ? 'bg-amber-400' : 'bg-indigo-500'
                }`}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
            isOver
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isOver ? <AlertTriangle size={15} /> : <TrendingUp size={15} />}
            {isOver
              ? `¥${Math.abs(remaining).toLocaleString()} オーバー`
              : `残り ¥${remaining.toLocaleString()}`}
          </div>
        </div>
      )}

      {showCalc && (
        <Calculator
          initialValue={amount}
          onConfirm={(v) => { setAmount(v); setAmountText(v > 0 ? v.toString() : ''); setShowCalc(false) }}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  )
}
