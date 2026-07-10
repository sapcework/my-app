import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) { // 本番ビルドのみSWを登録（開発時のキャッシュ事故を防ぐ）
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {}) // 登録失敗は無視（オフライン機能が無効になるだけ）
  })
}
