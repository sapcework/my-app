import { User } from '@/lib/types';

const KEY = 'auth-cached-profile';

// 起動時に前回のプロフィールを即座に表示するためのローカルキャッシュ。
// LINE等の一般的なチャットアプリと同様、サーバー確認を待たずにまず表示し、
// 裏側で本当のログイン状態を確認する（stale-while-revalidate）。
export function getCachedProfile(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setCachedProfile(profile: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile));
    else localStorage.removeItem(KEY);
  } catch {
    // ストレージ容量オーバー等は無視（キャッシュは無くても動作に支障はない）
  }
}
