export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const PUSH_ENDPOINT_KEY = 'push_endpoint'; // ローカルに保存した前回エンドポイント

export async function subscribeToPush(): Promise<PushSubscriptionData | null> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!('serviceWorker' in navigator) || !publicKey) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const stored = localStorage.getItem(PUSH_ENDPOINT_KEY);

    // 再起動等でエンドポイントが変わった場合は強制再登録
    if (sub && sub.endpoint !== stored) {
      await sub.unsubscribe();
      sub = null;
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
    }

    const data = sub.toJSON() as PushSubscriptionData;
    localStorage.setItem(PUSH_ENDPOINT_KEY, data.endpoint); // 最新エンドポイントを保存
    return data;
  } catch {
    return null;
  }
}
