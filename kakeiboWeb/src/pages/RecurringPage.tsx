import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Repeat2, Calculator as CalcIcon } from 'lucide-react'
import { Calculator } from '../components/Calculator'
import { useRecurringStore } from '../store/recurringStore'
import { useCategoryStore } from '../store/categoryStore'
import { confirmDialog } from '../store/dialogStore'
import { showToast } from '../store/toastStore'
import type { RecurringExpense } from '../types'

type FormState = {
  name: string
  amount: string
  categoryId: string
  day: string
}

const emptyForm = (defaultCatId: string): FormState => ({
  name: '',
  amount: '',
  categoryId: defaultCatId,
  day: '1',
})

export const RecurringPage = () => {
  const navigate = useNavigate()
  const { recurring, addRecurring, updateRecurring, deleteRecurring } = useRecurringStore()
  const { categories } = useCategoryStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(categories[0]?.id ?? ''))

  const getCat = (id: string) => categories.find((c) => c.id === id)

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm(categories[0]?.id ?? ''))
    setShowForm(true)
  }

  const openEdit = (r: RecurringExpense) => {
    setEditingId(r.id)
    setForm({ name: r.name, amount: r.amount.toString(), categoryId: r.categoryId, day: r.dayOfMonth.toString() })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setShowCalc(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.categoryId || !form.name.trim()) return
    const data = {
      name: form.name.trim(),
      amount: Number(form.amount),
      categoryId: form.categoryId,
      dayOfMonth: Number(form.day),
    }
    if (editingId) {
      updateRecurring(editingId, data)
    } else {
      addRecurring(data)
    }
    closeForm()
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({ title: '定期支出を削除', message: `「${name}」を削除しますか？`, confirmLabel: '削除', danger: true })
    if (ok) {
      deleteRecurring(id)
      showToast({ message: `「${name}」を削除しました` })
      if (editingId === id) closeForm()
    }
  }

  const total = recurring.reduce((s, r) => s + r.amount, 0)
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const inputClass = "w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
  const labelClass = "block text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2"

  return (
    <div className="pt-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/settings')}
            aria-label="戻る"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">定期支出</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        >
          <Plus size={14} />
          追加
        </button>
      </div>

      {/* フォーム（ボトムシート） */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl p-5 pb-10 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editingId ? '定期支出を編集' : '定期支出を追加'}
              </h2>
              <button
                onClick={closeForm}
                aria-label="閉じる"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>支出名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  className={inputClass}
                  placeholder="例：家賃、サブスク"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>金額</label>
                <div className={`w-full flex items-center gap-2 border rounded-xl px-4 py-2.5 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/15 ${
                    Number(form.amount) > 0
                      ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                  <span className="text-slate-400 text-sm flex-shrink-0">¥</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d]/g, '') }))}
                    placeholder="0"
                    className="flex-1 text-xl font-bold tracking-tight tabular-nums bg-transparent outline-none text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-600 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalc(true)}
                    aria-label="電卓を開く"
                    className="flex-shrink-0 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-0.5"
                  >
                    <CalcIcon size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>カテゴリ</label>
                <select
                  value={form.categoryId}
                  onChange={set('categoryId')}
                  className={inputClass + ' bg-white dark:bg-slate-900'}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>毎月何日</label>
                <select
                  value={form.day}
                  onChange={set('day')}
                  className={inputClass + ' bg-white dark:bg-slate-900'}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>毎月{d}日に自動登録</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId, form.name)}
                    className="flex-1 border border-rose-200 dark:border-rose-900 text-rose-500 dark:text-rose-400 py-3 rounded-xl text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    削除
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!form.amount || Number(form.amount) === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingId ? '更新する' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 電卓（ボトムシートの上に重なる） */}
      {showCalc && (
        <Calculator
          initialValue={Number(form.amount) || 0}
          onConfirm={(v) => { setForm((f) => ({ ...f, amount: v > 0 ? v.toString() : '' })); setShowCalc(false) }}
          onClose={() => setShowCalc(false)}
        />
      )}

      {/* 月間合計 */}
      {recurring.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 px-4 py-3 flex justify-between items-center">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-400">月間合計</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight">
            ¥{total.toLocaleString()}
          </span>
        </div>
      )}

      {/* リスト */}
      {recurring.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Repeat2 size={24} className="text-slate-400 dark:text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-400">定期支出がありません</p>
          <button
            onClick={openAdd}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
          >
            最初の定期支出を追加する
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {recurring.map((r) => {
            const cat = getCat(r.categoryId)
            return (
              <li
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '20' }}
                  >
                    {cat?.icon ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: cat?.color ?? '#9E9E9E' }}>
                      {cat?.name ?? '不明'}
                    </p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">毎月{r.dayOfMonth}日</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    ¥{r.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => openEdit(r)}
                    className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                  >
                    編集
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
