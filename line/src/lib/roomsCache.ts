import { Room } from '@/lib/types';

interface RoomsCacheData {
  rooms: Room[];
  memberRoomIds: string[];
  unreadCounts: Record<string, number>;
}

const keyFor = (userId: string) => `rooms-cached-${userId}`;

// トーク一覧を起動時に即座に表示するためのローカルキャッシュ（ユーザーごとに分離）。
// プロフィールと同様、サーバー確認を待たずにまず表示し、裏側で最新化する。
export function getCachedRooms(userId: string): RoomsCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as RoomsCacheData) : null;
  } catch {
    return null;
  }
}

export function setCachedRooms(userId: string, data: RoomsCacheData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(data));
  } catch {
    // ストレージ容量オーバー等は無視（キャッシュは無くても動作に支障はない）
  }
}
