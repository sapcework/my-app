const CACHE_NAME = 'line-chat-v1';

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
