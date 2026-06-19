'use client';

export const dynamic = 'force-dynamic';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { identifierToEmail } from '@/lib/username';
import { APP_INFO } from '@/lib/appInfo';

// useSearchParams を使うため Suspense でラップする（App Router の prerender 要件）
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/rooms'; // ログイン後リダイレクト先
  const [identifier, setIdentifier] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lastLoginId') ?? '') : ''
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ユーザー名→擬似メール（@を含む入力は既存メールとして扱う）に変換して送信
    const email = identifierToEmail(identifier);
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
      localStorage.setItem('lastLoginId', identifier.trim()); // 成功時に入力を保存
      // APIルート（サーバー側）でcookieが設定されるため、ハード遷移で
      // AuthProvider を再マウントしてセッションを読み直させる（client遷移だと認識されず読込中で固まる）
      window.location.assign(redirectTo.startsWith('/') ? redirectTo : '/rooms');
      return;
    }

    if (data.error === 'suspended') {
      setError('このアカウントは停止されています。管理者にお問い合わせください。');
    } else if (data.error === 'locked') {
      setError(`ログインが連続5回失敗しました。あと${data.remainingMinutes}分後に再試行できます。`);
    } else if (data.error === 'invalid_credentials') {
      if ((data.remaining ?? 0) === 0) {
        setError('ユーザー名またはパスワードが正しくありません。アカウントがロックされました。');
      } else if ((data.remaining ?? 0) === 1) {
        setError('ユーザー名またはパスワードが正しくありません。あと1回失敗するとロックされます。');
      } else {
        setError('ユーザー名またはパスワードが正しくありません。');
      }
    } else {
      setError('エラーが発生しました。もう一度お試しください。');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] flex flex-col items-center justify-center px-6">
      {/* ロゴ */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-[#4CAF50] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white text-4xl font-black">{APP_INFO.name.charAt(0).toUpperCase()}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{APP_INFO.name}</h1>
        <p className="text-gray-500 text-sm mt-1">つながろう、いつでも</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="ユーザー名"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-[#2a2a2a] dark:text-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] transition-colors"
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-[#2a2a2a] dark:text-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#4CAF50] transition-colors"
        />

        {error && (
          <p className="text-red-500 text-xs px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4CAF50] text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-opacity active:scale-95 transition-transform"
        >
          {loading ? '処理中...' : 'ログイン'}
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-400 text-center max-w-sm">
        アカウントは管理者が発行します。ログインできない場合は管理者にお問い合わせください。
      </p>
    </div>
  );
}
