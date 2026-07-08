'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/lib/withTimeout';
import { getCachedProfile, setCachedProfile } from '@/lib/authCache';
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
  // 前回のプロフィールがキャッシュにあれば、サーバー確認を待たずに即座に表示する
  // （LINE等の一般的なチャットアプリと同様のstale-while-revalidate方式）。
  // 裏側で本当のログイン状態を確認し、無効だった場合のみ後から未ログイン状態に切り替える。
  const [state, setState] = useState<AuthState>(() => {
    const cached = getCachedProfile();
    return { supabaseUser: null, profile: cached, loading: !cached };
  });

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    let resolved = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchProfile = async (userId: string) => {
      // ⚠️ getUser() 同様、このクエリにもタイムアウトを設けないと固まる原因になる
      const { data } = await withTimeout(
        supabase.from('users').select('*').eq('id', userId).single(),
        8000
      );
      if (data?.is_suspended) { // 停止済みユーザーは即時サインアウト
        await supabase.auth.signOut();
        setCachedProfile(null);
        return null;
      }
      return data as User | null;
    };

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
          setCachedProfile(profile); // 最新のプロフィールでキャッシュを更新
          if (!cancelled) setState({ supabaseUser: user, profile, loading: false });
        } else {
          setCachedProfile(null); // 本当に未ログインと確定した場合のみキャッシュを消す
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
          try {
            const profile = await fetchProfile(session.user.id);
            setCachedProfile(profile);
            setState({ supabaseUser: session.user, profile, loading: false });
          } catch {
            // タイムアウト時は無視（init()側の自動リトライがloadingの解消を担う）
          }
        } else {
          setCachedProfile(null);
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
    setCachedProfile(null);
  };

  // last_seen を定期更新（60秒ごと）。キャッシュ表示中（supabaseUser未確定）でも
  // profile.id は分かっているため、検証完了を待たずに更新を開始できる。
  useEffect(() => {
    const userId = state.profile?.id;
    if (!userId) return;
    const update = () =>
      supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId);

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [state.profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
