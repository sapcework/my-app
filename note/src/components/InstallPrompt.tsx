'use client'

import { useEffect, useState } from 'react'
import { isTauri } from '@/lib/platform'

// 「ホーム画面に追加」の案内バナー。
// - Android/PC Chrome系: beforeinstallprompt を捕まえ、ボタンでネイティブのインストールダイアログを起動
// - iOS Safari: インストールAPIが無いため「共有 → ホーム画面に追加」の手順を案内
// - インストール済み（standalone）・Tauri・一度閉じた場合は表示しない

const DISMISSED_KEY = 'simplenote-install-prompt-dismissed'
const SHOW_DELAY_MS = 3000 // 起動直後を邪魔しないよう少し待ってから表示

// beforeinstallprompt は TypeScript 標準の型定義に無いため自前で定義
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  // PWAとして起動済みか（iOS は navigator.standalone、それ以外は display-mode で判定）
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isIos(): boolean {
  // iPadOS 13+ は Mac を名乗るため、タッチ点数でも判定する
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const ShareIcon = () => (
  <svg className="w-4 h-4 inline -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
    <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)

export function InstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden')
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isTauri() || isStandalone()) return
    try { if (localStorage.getItem(DISMISSED_KEY)) return } catch { /* 判定不能時は表示を試みる */ }

    let timer: ReturnType<typeof setTimeout> | null = null

    // Android/PC: インストール可能になるとブラウザがこのイベントを発火する
    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // ブラウザ標準のミニバーを抑止し、自前バナーに一本化
      setInstallEvent(e as BeforeInstallPromptEvent)
      timer = setTimeout(() => setMode('native'), SHOW_DELAY_MS)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // インストール完了したら二度と出さない
    const onInstalled = () => { dismiss() }
    window.addEventListener('appinstalled', onInstalled)

    // iOS はイベントが無いので、iOS Safari とみなせる場合に手順案内を出す
    if (isIos()) {
      timer = setTimeout(() => setMode('ios'), SHOW_DELAY_MS)
    }

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setMode('hidden')
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* noop */ }
  }

  async function handleInstall() {
    if (!installEvent) return
    setMode('hidden') // ネイティブダイアログと二重表示にしない
    await installEvent.prompt()
    await installEvent.userChoice
    dismiss() // 受諾・拒否どちらでも、しつこく再表示しない
  }

  if (mode === 'hidden') return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="ホーム画面に追加の案内"
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow shadow-blue-500/30">
          <span className="text-xl" aria-hidden="true">📝</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            ホーム画面に追加すると、アプリのように使えます
          </p>
          {mode === 'ios' ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Safari の共有ボタン <ShareIcon /> をタップして「<span className="font-medium">ホーム画面に追加</span>」を選んでください
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              オフラインでも全画面で快適に使えます
            </p>
          )}
          <div className="flex gap-2 mt-2.5">
            {mode === 'native' && (
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                追加する
              </button>
            )}
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              あとで
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="閉じる"
          className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
