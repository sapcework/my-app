import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { setCachedProfile } from '@/lib/authCache';

// getUser()を意図的に解決させず「サーバー検証はまだ完了していない」状態を模す。
// この状態でもキャッシュがあれば即座に表示されることを確認する（起動時の体感速度改善の核心）。
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => new Promise(() => {}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }),
      update: () => ({ eq: () => ({ then: (resolve?: (v: unknown) => void) => { resolve?.({ error: null }); return Promise.resolve(); } }) }),
    }),
  }),
}));

function Probe() {
  const { profile, loading } = useAuth();
  return <div data-testid="state">{loading ? 'loading' : (profile?.display_name ?? 'no-profile')}</div>;
}

describe('AuthProvider cached profile (stale-while-revalidate)', () => {
  beforeEach(() => localStorage.clear());

  it('renders the cached profile immediately without waiting for server verification', () => {
    setCachedProfile({
      id: 'u1',
      email: 'taro@talk.local',
      display_name: 'Taro',
      avatar_url: null,
      last_seen: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    });

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByTestId('state').textContent).toBe('Taro');
  });

  it('shows loading when there is no cached profile yet (first-ever launch)', () => {
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByTestId('state').textContent).toBe('loading');
  });
});
