import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calculator } from '../components/Calculator'
import { useExpenseStore } from '../store/expenseStore'
import { useCategoryStore } from '../store/categoryStore'
import { useUIStore } from '../store/uiStore'
import { firstDayOfMonth, formatDateWithDay } from '../utils/date'

export const ExpenseFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { selectedMonth } = useUIStore()

  const existing = id ? expenses.find((e) => e.id === id) : undefined
  const defaultDate = existing?.date ?? firstDayOfMonth(selectedMonth)

  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories[0]?.id ?? '')
  const [itemName, setItemName] = useState(existing?.itemName ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [date, setDate] = useState(defaultDate)
  const [showCalc, setShowCalc] = useState(false)

  // 過去の項目名サジェスト（重複除去）
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

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 text-xl">‹</button>
          <h1 className="text-xl font-bold text-gray-800">
            {existing ? '支出を編集' : '支出を追加'}
          </h1>
        </div>
        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-500 font-medium px-3 py-1 rounded-lg hover:bg-red-50"
          >
            削除
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        {/* 金額（電卓で入力） */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">金額</label>
          <button
            type="button"
            onClick={() => setShowCalc(true)}
            className="w-full flex items-center border rounded-xl px-3 py-3 text-left hover:bg-gray-50"
          >
            <span className="text-gray-400 mr-1">¥</span>
            <span className={`flex-1 text-lg font-semibold ${amount === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
              {amount === 0 ? '0' : amount.toLocaleString()}
            </span>
            <span className="text-gray-300 text-sm">🔢</span>
          </button>
        </div>

        {/* カテゴリ */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">カテゴリ</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-2 p-2 rounded-xl border text-sm transition-colors ${
                  categoryId === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 日付 */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 outline-none"
            required
          />
          {date && (
            <p className="text-sm text-gray-500 mt-1.5 pl-1">{formatDateWithDay(date)}</p>
          )}
        </div>

        {/* 項目名（サジェスト付き） */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">項目名（任意）</label>
          <input
            type="text"
            list="item-suggestions"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 outline-none"
            placeholder="例：スーパーABC"
          />
          <datalist id="item-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        {/* メモ（複数行） */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">メモ（任意）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 outline-none resize-none"
            placeholder="メモを入力"
            rows={2}
          />
        </div>

        <button
          type="submit"
          disabled={amount === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
