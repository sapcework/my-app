const CACHE_NAME = 'line-chat-v2';

// キャッシュするスタティックアセット
const STATIC_CACHE = [
  '/',
  '/login',
  '/rooms',
  '/manifest.json',
  '/icon.svg',
];

// インストール：スタティックアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE))
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push通知受信（バックグラウンド）
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, roomId } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: roomId,        // 同じルームの通知は上書き
      data: { roomId },
      silent: false,      // OS のデフォルト通知音を鳴らす
      vibrate: [200, 100, 200], // バイブレーションパターン
    })
  );
});

// 通知タップ → 該当ルームへ遷移
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { roomId } = event.notification.data;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/rooms/'));
      if (existing) { existing.focus(); return existing.navigate(`/rooms/${roomId}`); }
      return self.clients.openWindow(`/rooms/${roomId}`);
    })
  );
});

// フェッチ：Supabase・API はネットワーク優先、その他はキャッシュ優先
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase・外部APIはキャッシュしない
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }

  // _next/static はキャッシュ優先
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // ページはネットワーク優先、失敗時にキャッシュ
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? new Response('offline', { status: 503 })))
  );
});
