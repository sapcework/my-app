import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export const LoginPage = () => {
  const { signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError('IDまたはパスワードが正しくありません')
    setLoading(false)
  }

  const inputClass = "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090912] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* ロゴ */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">家計簿</h1>
          <p className="text-sm text-slate-400 dark:text-slate-400">アカウントにログイン</p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ログインID"
              required
              autoComplete="username"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          アカウントは管理者が発行します
        </p>
      </div>
    </div>
  )
}
