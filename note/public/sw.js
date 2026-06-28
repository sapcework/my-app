// SimpleNote Service Worker（Web版のみ。オフラインでもアプリ本体を起動できるようにする）
// 方針: ネットワーク優先 + キャッシュフォールバック（network-first）。
//   - オンライン時: 常に最新を取得しつつキャッシュも更新（デプロイ後すぐ反映）
//   - オフライン時: キャッシュから配信（圏外でも起動）
// Supabase等の外部API（別オリジン）はキャッシュ対象外 → 同期は通常通りネット依存。

const CACHE = 'simplenote-v1'
const APP_SHELL = ['/', '/auth']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined) // 一部取得失敗でもインストールは継続
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // 書き込み系は対象外

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 同一オリジンのみ（Supabase等は除外）

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 取得成功 → 静的アセット/ページをキャッシュ更新
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined)
        return res
      })
      .catch(async () => {
        // オフライン → キャッシュ、無ければトップページで代替
        const cached = await caches.match(req)
        return cached || caches.match('/')
      })
  )
})
