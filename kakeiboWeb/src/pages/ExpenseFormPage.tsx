import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Calculator as CalcIcon } from 'lucide-react'
import { Calculator } from '../components/Calculator'
import { DatePicker } from '../components/DatePicker'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { confirmDialog } from '../store/dialogStore'

export const ExpenseFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()
  const { categories } = useCategoryStore()
  const existing = id ? expenses.find((e) => e.id === id) : undefined

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const defaultDate = existing?.date ?? todayStr

  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [amountText, setAmountText] = useState(existing?.amount ? existing.amount.toString() : '')
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '')
  const [itemName, setItemName] = useState(existing?.itemName ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [date, setDate] = useState(defaultDate)
  const [showCalc, setShowCalc] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const itemInputRef = useRef<HTMLInputElement>(null)

  const allSuggestions = (() => {
    const countMap = new Map<string, number>()
    expenses
      .filter((e) => e.itemName?.trim() && e.categoryId === categoryId)
      .forEach((e) => {
        const key = e.itemName!
        countMap.set(key, (countMap.get(key) ?? 0) + 1)
      })
    return [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  })()
  const filteredSuggestions = allSuggestions.filter((s) =>
    s.toLowerCase().includes(itemName.toLowerCase())
  )

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

  const handleDelete = async () => {
    if (!existing) return
    const ok = await confirmDialog({
      title: '支出を削除',
      message: 'この支出を削除しますか？',
      confirmLabel: '削除',
      danger: true,
    })
    if (ok) {
      deleteExpense(existing.id)
      navigate(-1)
    }
  }

  const inputClass = "w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
  const labelClass = "block text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2"

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            aria-label="戻る"
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
          <label className={labelClass}>金額</label>
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

        {/* カテゴリ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 px-4 py-3">
          <label className={labelClass}>カテゴリ</label>
          <div className="grid grid-cols-4 gap-1">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                  categoryId === c.id
                    ? 'border-transparent text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                style={categoryId === c.id ? { backgroundColor: c.color } : {}}
              >
                <span className="text-base leading-none">{c.icon}</span>
                <span className="truncate w-full text-center text-[10px]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 日付・項目名・メモ */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 space-y-4">
          {/* 日付 */}
          <div>
            <label className={labelClass}>日付</label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* 項目名 */}
          <div className="relative">
            <label className={labelClass}>項目名（任意）</label>
            <input
              ref={itemInputRef}
              type="text"
              value={itemName}
              onChange={(e) => { setItemName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className={inputClass}
              placeholder="例：スーパーABC"
              autoComplete="off"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                {filteredSuggestions.map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => { setItemName(s); setShowSuggestions(false) }}
                    onTouchEnd={() => { setItemName(s); setShowSuggestions(false) }}
                    className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 active:bg-indigo-100 cursor-pointer transition-colors"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
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

        {/* 追加ボタン（Navbar直上に固定・カテゴリが多くても常に押せる） */}
        <div className="sticky bottom-0 -mx-4 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-50 from-45% to-transparent dark:from-[#090912]">
          <button
            type="submit"
            disabled={amount === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20"
          >
            {existing ? '更新する' : '追加する'}
          </button>
        </div>
      </form>

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
