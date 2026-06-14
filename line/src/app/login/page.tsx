'use client';

export const dynamic = 'force-dynamic';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // サインアップはそのまま
    if (mode === 'signup') {
      const err = await signUp(email, password, displayName);
      setLoading(false);
      if (err) { setError(err.message); } else { router.push('/rooms'); }
      return;
    }

    // サインインはAPIルート経由（レート制限付き）
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as {
      ok?: boolean;
      error?: string;
      remainingMinutes?: number;
      remaining?: number;
    };
    setLoading(false);

    if (data.ok) {
      router.push('/rooms');
      return;
    }

    if (data.error === 'locked') {
      setError(`ログインが${5}回連続で失敗しました。あと${data.remainingMinutes}分後に再試行できます。`);
    } else if (data.error === 'invalid_credentials') {
      if ((data.remaining ?? 0) === 0) {
        setError('メールアドレスまたはパスワードが正しくありません。アカウントがロックされました。');
      } else {
        setError(`メールアドレスまたはパスワードが正しくありません。あと${data.remaining}回失敗するとロックされます。`);
      }
    } else {
      setError('エラーが発生しました。もう一度お試しください。');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* LINEロゴ風 */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-[#4CAF50] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white text-4xl font-black">L</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">LINE Chat</h1>
        <p className="text-gray-500 text-sm mt-1">つながろう、いつでも</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] transition-colors"
          />
        )}
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] transition-colors"
        />
        <input
          type="password"
          placeholder="パスワード（6文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] transition-colors"
        />

        {error && (
          <p className="text-red-500 text-xs px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4CAF50] text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-opacity active:scale-95 transition-transform"
        >
          {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : 'アカウント作成'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
        className="mt-6 text-sm text-[#4CAF50] font-medium"
      >
        {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方'}
      </button>
    </div>
  );
}
