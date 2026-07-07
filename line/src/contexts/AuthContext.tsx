'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

interface AuthContextValue {
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthState {
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    supabaseUser: null,
    profile: null,
    loading: true,
  });

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    let resolved = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (data?.is_suspended) { // 停止済みユーザーは即時サインアウト
        await supabase.auth.signOut();
        return null;
      }
      return data as User | null;
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    const init = async () => {
      try {
        // getUser() はネットワーク経由で cookie を検証（httpOnly cookie でも確実に読める）。
        // AuthProvider は全画面共有で初回1回だけ実行されるため、遷移ごとの通信は発生しない。
        // ⚠️ スマホがスリープ後に復帰した直後は接続が半端に残り fetch が応答しないことがあるため、
        //    タイムアウトを設けて「読み込み中...」のまま固まるのを防ぐ。
        const { data: { user } } = await withTimeout(supabase.auth.getUser(), 8000);
        if (cancelled) return;
        resolved = true;
        if (user) {
          const profile = await fetchProfile(user.id);
          if (!cancelled) setState({ supabaseUser: user, profile, loading: false });
        } else {
          setState({ supabaseUser: null, profile: null, loading: false });
        }
      } catch {
        // タイムアウト/通信エラー時は「未ログイン」と誤判定せず、接続が戻るまで自動で再試行する
        if (!cancelled) retryTimer = setTimeout(init, 4000);
      }
    };

    init();

    // スリープ復帰などで画面に戻ってきた時、まだ読み込み中なら即座に再試行（バックオフ待ちを短縮）
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !resolved) {
        clearTimeout(retryTimer);
        init();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({ supabaseUser: session.user, profile, loading: false });
        } else {
          setState({ supabaseUser: null, profile: null, loading: false });
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`, // 確認リンクの戻り先
      },
    });
    // メール確認ON時は session が null（リンク確認待ち）、OFF時は即セッション発行
    return { error, needsConfirmation: !error && !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // last_seen を定期更新（60秒ごと）
  useEffect(() => {
    if (!state.supabaseUser) return;
    const update = () =>
      supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', state.supabaseUser!.id);

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [state.supabaseUser]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使用してください');
  return ctx;
}
