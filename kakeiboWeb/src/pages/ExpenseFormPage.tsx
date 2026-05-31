import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Calculator as CalcIcon } from 'lucide-react'
import { Calculator } from '../components/Calculator'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { firstDayOfMonth, formatDateWithDay, toYearMonth } from '../utils/date'

export const ExpenseFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { selectedMonth } = useUIStore()

  const existing = id ? expenses.find((e) => e.id === id) : undefined

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const defaultDate = existing?.date ?? (selectedMonth === toYearMonth(new Date()) ? todayStr : firstDayOfMonth(selectedMonth))

  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '')
  const [itemName, setItemName] = useState(existing?.itemName ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [date, setDate] = useState(defaultDate)
  const [showCalc, setShowCalc] = useState(false)

  const suggestions = [...new Set(
    expenses
      .filter((e) => e.itemName && e.itemName.trim())
      .map((e) => e.itemName!)
  )]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId) return
    if (existing) {
      updateExpense(existing.id, { amount, categoryId, itemName, note, date })
    } else {
      addExpense({ amount, categoryId, itemName, note, date })
    }
    navigate(-1)
  }

  const handleDelete = () => {
    if (!existing) return
    if (confirm('この支出を削除しますか？')) {
      deleteExpense(existing.id)
      navigate(-1)
    }
  }

  const inputClass = "w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
  const labelClass = "block text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            {existing ? '支出を編集' : '支出を追加'}
          </h1>
        </div>
        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-rose-500 font-medium px-3 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            <Trash2 size={13} />
            削除
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 金額 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5">
          <label className={labelClass}>金額</label>
          <button
            type="button"
            onClick={() => setShowCalc(true)}
            className={`w-full flex items-center justify-between border rounded-xl px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99] transition-all ${
              amount > 0
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">¥</span>
              <span className={`text-2xl font-bold tracking-tight tabular-nums ${
                amount === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-slate-50'
              }`}>
                {amount === 0 ? '0' : amount.toLocaleString()}
              </span>
            </div>
            <CalcIcon size={16} className="text-slate-400" />
          </button>
        </div>

        {/* カテゴリ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5">
          <label className={labelClass}>カテゴリ</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  categoryId === c.id
                    ? 'border-transparent text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                style={categoryId === c.id ? { backgroundColor: c.color } : {}}
              >
                <span className="text-base">{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 日付・項目名・メモ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 space-y-4">
          {/* 日付 */}
          <div>
            <label className={labelClass}>日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
            {date && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 pl-1">{formatDateWithDay(date)}</p>
            )}
          </div>

          {/* 項目名 */}
          <div>
            <label className={labelClass}>項目名（任意）</label>
            <input
              type="text"
              list="item-suggestions"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className={inputClass}
              placeholder="例：スーパーABC"
            />
            <datalist id="item-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* メモ */}
          <div>
            <label className={labelClass}>メモ（任意）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass + ' resize-none'}
              placeholder="メモを入力"
              rows={2}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={amount === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20"
        >
          {existing ? '更新する' : '追加する'}
        </button>
      </form>

      {showCalc && (
        <Calculator
          initialValue={amount}
          onConfirm={(v) => { setAmount(v); setShowCalc(false) }}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  )
}
