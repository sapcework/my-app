import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Tag, Pencil } from 'lucide-react'
import { useCategoryStore } from '../store/categoryStore'
import { useExpenseStore } from '../store/expenseStore'
import { confirmDialog } from '../store/dialogStore'
import { showToast } from '../store/toastStore'
import { activatable } from '../utils/interactive'

const COLORS = [
  '#FF9800', '#2196F3', '#4CAF50', '#9C27B0',
  '#F44336', '#009688', '#E91E63', '#3F51B5',
  '#FF5722', '#795548', '#607D8B', '#9E9E9E',
]
const ICONS = ['🍽️', '🚗', '🛒', '🎮', '🏥', '🏠', '💼', '🎓', '☕', '✈️', '💪', '📦']

export const CategoryPage = () => {
  const navigate = useNavigate()
  const { categories, addCategory, updateCategory, deleteCategory } = useCategoryStore()
  const { expenses } = useExpenseStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // 編集中カテゴリのid（nullなら新規追加）
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setColor(COLORS[0])
    setIcon(ICONS[0])
    setShowForm(false)
  }

  const openEdit = (id: string) => {
    const c = categories.find((cat) => cat.id === id)
    if (!c) return
    setEditingId(c.id)
    setName(c.name)
    setColor(c.color)
    setIcon(c.icon)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' }) // フォームは画面上部にあるため
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (editingId) {
      updateCategory(editingId, { name: name.trim(), color, icon })
      showToast({ message: `「${name.trim()}」を更新しました` })
    } else {
      addCategory({ name: name.trim(), color, icon })
      showToast({ message: `「${name.trim()}」を追加しました` })
    }
    resetForm()
  }

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">カテゴリ</h1>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
            showForm
              ? 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
              : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100'
          }`}
        >
          {!showForm && <Plus size={14} />}
          {showForm ? 'キャンセル' : '追加'}
        </button>
      </div>

      {/* 追加・編集フォーム */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 space-y-4"
        >
          {/* 名前入力 */}
          <div>
            <label className={labelClass}>名前</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="カテゴリ名"
              required
            />
          </div>

          {/* アイコン選択 */}
          <div>
            <label className={labelClass}>アイコン</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`text-xl p-2.5 rounded-xl transition-all ${
                    icon === ic
                      ? 'ring-2 ring-offset-1 ring-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={icon === ic ? { backgroundColor: color + '30' } : {}}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* カラー選択 */}
          <div>
            <label className={labelClass}>カラー</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full transition-transform active:scale-90 ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: color + '30' }}
            >
              {icon}
            </div>
            <span className="text-sm font-bold" style={{ color }}>{name || 'プレビュー'}</span>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20"
          >
            {editingId ? '更新する' : '追加する'}
          </button>
        </form>
      )}

      {/* カテゴリリスト */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Tag size={24} className="text-slate-400 dark:text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-400">カテゴリがありません</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 flex items-center justify-between"
            >
              <div
                {...activatable(() => openEdit(c.id), `${c.name} を編集`)}
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer rounded-xl -m-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: c.color + '20' }}
                >
                  {c.icon}
                </div>
                <span className="text-sm font-bold truncate" style={{ color: c.color }}>{c.name}</span>
                <Pencil size={13} className="text-slate-300 dark:text-slate-500 flex-shrink-0" />
              </div>
              <button
                onClick={async () => {
                  const usedCount = expenses.filter((e) => e.categoryId === c.id).length
                  const message = usedCount > 0
                    ? `「${c.name}」を削除しますか？\nこのカテゴリを使用している支出が${usedCount}件あります（削除後も支出データ自体は残り、カテゴリ表示が「不明」になります）。`
                    : `「${c.name}」を削除しますか？`
                  const ok = await confirmDialog({ title: 'カテゴリを削除', message, confirmLabel: '削除', danger: true })
                  if (ok) {
                    deleteCategory(c.id)
                    if (editingId === c.id) resetForm() // 編集中のカテゴリを消したらフォームも閉じる
                    showToast({ message: `「${c.name}」を削除しました` })
                  }
                }}
                aria-label={`${c.name} を削除`}
                className="text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
