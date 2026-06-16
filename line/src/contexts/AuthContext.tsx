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
  signUp: (email: string, password: string, displayName: string) => Promise<AuthError | null>;
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

    const init = async () => {
      // getUser() はネットワーク経由で cookie を検証（httpOnly cookie でも確実に読める）。
      // AuthProvider は全画面共有で初回1回だけ実行されるため、遷移ごとの通信は発生しない。
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await fetchProfile(user.id);
        setState({ supabaseUser: user, profile, loading: false });
      } else {
        setState({ supabaseUser: null, profile: null, loading: false });
      }
    };

    init();

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

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return error;
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
