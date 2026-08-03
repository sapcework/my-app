import { useState, useEffect, useRef } from 'react'
import { BookOpen } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const MAX_ATTEMPTS = 5 // この回数連続で失敗するとクールダウンを挟む
const COOLDOWN_SEC = 15

export const LoginPage = () => {
  const { signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0) // 残り秒数（0なら制限なし）
  const cooldownTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearInterval(cooldownTimer.current), [])

  const startCooldown = () => {
    setCooldown(COOLDOWN_SEC)
    cooldownTimer.current = window.setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { window.clearInterval(cooldownTimer.current); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cooldown > 0) return
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (!err) return

    // Supabase側のレート制限（429）はそれと分かるメッセージにする
    if (err.status === 429) {
      setError('試行回数が多すぎます。しばらく待ってから再度お試しください')
      startCooldown()
      return
    }
    setError('IDまたはパスワードが正しくありません')
    // クライアント側でも連続失敗時に短いクールダウンを挟む（UI上の抑止であり、実際の保護はSupabase側のレート制限に依存）
    const next = failedAttempts + 1
    setFailedAttempts(next)
    if (next >= MAX_ATTEMPTS) {
      setFailedAttempts(0)
      startCooldown()
    }
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
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
            disabled={loading || cooldown > 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {cooldown > 0 ? `${cooldown}秒後に再試行できます` : loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          アカウントは管理者が発行します
        </p>
      </div>
    </div>
  )
}
