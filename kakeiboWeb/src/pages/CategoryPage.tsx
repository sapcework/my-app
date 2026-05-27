import { useState } from 'react'
import { useCategoryStore } from '../store/categoryStore'

// Flutter版に準拠した12色・12アイコン
const COLORS = [
  '#FF9800', '#2196F3', '#4CAF50', '#9C27B0',
  '#F44336', '#009688', '#E91E63', '#3F51B5',
  '#FF5722', '#795548', '#607D8B', '#9E9E9E',
]
const ICONS = ['🍽️','🚗','🛒','🎮','🏥','🏠','💼','🎓','☕','✈️','💪','📦']

export const CategoryPage = () => {
  const { categories, addCategory, deleteCategory } = useCategoryStore()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState(ICONS[0])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addCategory({ name: name.trim(), color, icon })
    setName('')
    setColor(COLORS[0])
    setIcon(ICONS[0])
    setShowForm(false)
  }

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">カテゴリ</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-blue-600 font-medium"
        >
          {showForm ? 'キャンセル' : '+ 追加'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">名前</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 outline-none"
              placeholder="カテゴリ名"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-2">アイコン</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`text-xl p-2 rounded-xl transition-colors ${
                    icon === ic
                      ? 'ring-2 ring-blue-500'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={icon === ic ? { backgroundColor: color + '33' } : {}}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-2">カラー</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {/* プレビュー */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: color + '33' }}
            >
              {icon}
            </div>
            <span className="font-bold" style={{ color }}>{name || 'プレビュー'}</span>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-xl font-semibold">
            追加する
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: c.color + '22' }}
              >
                {c.icon}
              </div>
              <span className="font-bold" style={{ color: c.color }}>{c.name}</span>
            </div>
            <button
              onClick={() => { if (confirm(`「${c.name}」を削除しますか？`)) deleteCategory(c.id) }}
              className="text-red-400 text-sm hover:text-red-600"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
