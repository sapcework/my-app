import { useState } from 'react'
import { useRecurringStore } from '../store/recurringStore'
import { useCategoryStore } from '../store/categoryStore'
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
  const { recurring, addRecurring, updateRecurring, deleteRecurring } = useRecurringStore()
  const { categories } = useCategoryStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
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

  const handleDelete = (id: string, name: string) => {
    if (confirm(`「${name}」を削除しますか？`)) {
      deleteRecurring(id)
      if (editingId === id) closeForm()
    }
  }

  const total = recurring.reduce((s, r) => s + r.amount, 0)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">定期支出</h1>
        <button onClick={openAdd} className="text-sm text-blue-600 font-medium">
          + 追加
        </button>
      </div>

      {/* 追加・編集フォーム（ボトムシート） */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative bg-white rounded-t-3xl p-5 pb-8 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{editingId ? '定期支出を編集' : '定期支出を追加'}</h2>
              <button onClick={closeForm} className="text-gray-400 w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">支出名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  className="w-full border rounded-xl px-3 py-2 outline-none"
                  placeholder="例：家賃、サブスク"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">金額</label>
                <div className="flex items-center border rounded-xl px-3 py-2">
                  <span className="text-gray-400 mr-1">¥</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={set('amount')}
                    className="flex-1 outline-none"
                    placeholder="0"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">カテゴリ</label>
                <select
                  value={form.categoryId}
                  onChange={set('categoryId')}
                  className="w-full border rounded-xl px-3 py-2 outline-none bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">毎月何日</label>
                <select
                  value={form.day}
                  onChange={set('day')}
                  className="w-full border rounded-xl px-3 py-2 outline-none bg-white"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>毎月{d}日に自動登録</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId, form.name)}
                    className="flex-1 border border-red-300 text-red-500 py-3 rounded-xl font-semibold hover:bg-red-50"
                  >
                    削除
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
                >
                  {editingId ? '更新する' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 flex justify-between">
          <span className="text-gray-500 text-sm">月間合計</span>
          <span className="font-bold text-gray-800">¥{total.toLocaleString()}</span>
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="text-center py-12 text-gray-400">定期支出がありません</div>
      ) : (
        <ul className="space-y-2">
          {recurring.map((r) => {
            const cat = getCat(r.categoryId)
            return (
              <li
                key={r.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#9E9E9E') + '22' }}
                  >
                    {cat?.icon ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: cat?.color ?? '#9E9E9E' }}>
                      {cat?.name ?? '不明'}
                    </p>
                    <p className="font-medium text-gray-800 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400">毎月{r.dayOfMonth}日</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-semibold text-gray-800">¥{r.amount.toLocaleString()}</span>
                  <button
                    onClick={() => openEdit(r)}
                    className="text-blue-400 text-sm hover:text-blue-600"
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
