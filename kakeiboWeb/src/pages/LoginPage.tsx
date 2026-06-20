import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export const LoginPage = () => {
  const { signIn, signUp } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpDone, setSignUpDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (mode === 'login') {
      const err = await signIn(email, password)
      if (err) setError('メールアドレスまたはパスワードが正しくありません')
    } else {
      const err = await signUp(email, password)
      if (err) setError('登録に失敗しました。パスワードは8文字以上にしてください')
      else setSignUpDone(true)
    }
    setLoading(false)
  }

  const inputClass = "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"

  if (signUpDone) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090912] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-8 w-full max-w-sm text-center space-y-3">
          <p className="text-2xl">📧</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">確認メールを送信しました</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {email} に届いたメールのリンクをクリックしてアカウントを有効化してください
          </p>
          <button
            onClick={() => { setSignUpDone(false); setMode('login') }}
            className="text-sm text-indigo-600 dark:text-indigo-400 font-medium"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090912] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* ロゴ */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">家計簿</h1>
          <p className="text-sm text-slate-400 dark:text-slate-400">
            {mode === 'login' ? 'アカウントにログイン' : 'アカウントを作成'}
          </p>
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
              autoComplete="email"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'パスワード（8文字以上）' : 'パスワード'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        {/* モード切替 */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className="text-indigo-600 dark:text-indigo-400 font-semibold ml-1"
          >
            {mode === 'login' ? '新規登録' : 'ログイン'}
          </button>
        </p>
      </div>
    </div>
  )
}
