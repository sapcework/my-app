const CACHE = 'kakeibo-v1' // キャッシュの世代名（更新時はバージョンを上げる）

// インストール時に即座に新しいSWを有効化する
self.addEventListener('install', () => self.skipWaiting())

// 有効化時に古い世代のキャッシュを削除し、即座にページを制御下に置く
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 同一オリジンのGETのみ対象。ネットワーク優先、失敗時はキャッシュで応答（オフライン対応）
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // 書き込み系は素通し
  if (new URL(request.url).origin !== self.location.origin) return // 外部リソース（フォント等）は素通し

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone() // レスポンスは一度しか読めないので複製してキャッシュ
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() =>
        // オフライン時: キャッシュ → 無ければSPAのindex.htmlにフォールバック
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  )
})
