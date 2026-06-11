'use client';

import { useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/types';

interface AuthState {
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
}

export function useAuth() {
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
      return data as User | null;
    };

    const init = async () => {
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

  return { ...state, signIn, signUp, signOut };
}
