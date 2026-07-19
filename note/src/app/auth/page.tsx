'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function AuthPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) {
      // 通信起因の失敗は認証エラーと区別して案内する（次に取るべき行動が変わるため）
      setError(/fetch|network|timeout|abort/i.test(err)
        ? '通信に失敗しました。ネットワーク接続を確認してもう一度お試しください'
        : 'メールアドレスまたはパスワードが正しくありません')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      {/* 戻るボタン */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-4 left-4 text-sm text-blue-500 hover:text-blue-700 transition-colors"
      >
        ← ノート一覧へ
      </button>

      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6 text-center">ログイン</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            autoComplete="email"
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            autoComplete="current-password"
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          {error && <p className="text-xs text-red-500" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
          アカウントは管理者が発行します
        </p>
      </div>
    </div>
  )
}
