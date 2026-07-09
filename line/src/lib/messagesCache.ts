import { Message } from '@/lib/types';

const keyFor = (roomId: string) => `messages-cached-${roomId}`;
const MAX_CACHE_MESSAGES = 100; // fetchMessagesの取得件数と揃える

// ルームのメッセージを起動時に即座に表示するためのローカルキャッシュ（ルームごとに分離）。
// プロフィール・トーク一覧と同じstale-while-revalidate方式。
export function getCachedMessages(roomId: string): Message[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(roomId));
    return raw ? (JSON.parse(raw) as Message[]) : null;
  } catch {
    return null;
  }
}

export function setCachedMessages(roomId: string, messages: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    // 送信中/失敗中など一時的な状態は含めず、確定済みメッセージのみ末尾N件をキャッシュ
    localStorage.setItem(keyFor(roomId), JSON.stringify(messages.slice(-MAX_CACHE_MESSAGES)));
  } catch {
    // ストレージ容量オーバー等は無視（キャッシュは無くても動作に支障はない）
  }
}
