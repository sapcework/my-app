'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { SortOrder } from '@/hooks/useSortOrder'
import { SORT_OPTIONS } from '@/hooks/useSortOrder'
import { useFontSize, FONT_SIZE_OPTIONS } from '@/hooks/useFontSize'
import { useTheme, THEME_OPTIONS } from '@/hooks/useTheme'
import { useStorage } from '@/context/StorageContext'
import { useAuth } from '@/context/AuthContext'
import { usePasscode } from '@/context/PasscodeContext'
import { PinPad } from '@/components/PinPad'
import { confirmDialog } from '@/lib/dialog'
import { showToast } from '@/lib/toast'
import { downloadCsv } from '@/utils/csv'
import { clearPasscode } from '@/lib/passcode'
import { TrashIcon } from '@/components/icons'
import type { Note } from '@/lib/types'

export type ListView = 'notes' | 'trash'

type Props = {
  open: boolean
  onClose: () => void
  sortOrder: SortOrder
  onSortChange: (order: SortOrder) => void
  view: ListView
  onViewChange: (v: ListView) => void
  trashCount: number
}

// ---- アイコン ----

const IconAllNotes = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconTrash = () => <TrashIcon className="w-4 h-4 shrink-0" />
const IconSettings = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IconRight = () => (
  <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IconExport = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const IconImport = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconCsv = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
)
const IconLogout = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconLogin = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
)
const IconLock = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

// ---- バリデーター ----

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/   // crypto.randomUUID 形式を含む安全なID文字種
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']) // プロトタイプ汚染対策
const MAX_LEN = 1_000_000 // 1ノートあたりのタイトル/本文の上限（肥大化・DoS防止）

function isValidNote(obj: unknown): obj is Note {
  if (typeof obj !== 'object' || obj === null) return false
  const n = obj as Record<string, unknown>
  if (typeof n.id !== 'string' || !ID_RE.test(n.id) || DANGEROUS_KEYS.has(n.id)) return false
  if (typeof n.title !== 'string' || n.title.length > MAX_LEN) return false
  if (typeof n.content !== 'string' || n.content.length > MAX_LEN) return false
  if (!Number.isFinite(n.createdAt) || !Number.isFinite(n.updatedAt)) return false
  if (n.version !== undefined && !Number.isFinite(n.version)) return false
  return true
}

// ---- 並べ替えモーダル ----

function SortModal({ current, onSelect, onClose }: {
  current: SortOrder; onSelect: (v: SortOrder) => void; onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="並べ替え"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">並べ替え</span>
          <button onClick={onClose} aria-label="閉じる" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
        </div>
        <div className="py-2">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { onSelect(value); onClose() }}
              className={`w-full flex items-center justify-between px-5 py-3 text-sm transition-colors ${
                current === value
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {label}
              {current === value && (
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- メインコンポーネント ----

const ROW = 'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors'
const SECTION = 'px-3 pt-1 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider'
const DIVIDER = 'my-1 border-t border-gray-200 dark:border-gray-800'

export function SideMenu({ open, onClose, sortOrder, onSortChange, view, onViewChange, trashCount }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [sortModalOpen, setSortModalOpen] = useState(false)
  const { fontSize, setFontSize } = useFontSize()
  const { theme, setTheme } = useTheme()
  const storage = useStorage()
  const { session, signOut } = useAuth()
  const { enabled: passcodeEnabled, setPasscode, removePasscode, verify, lock } = usePasscode()
  const fileRef = useRef<HTMLInputElement>(null)

  // パスコード設定シート
  const [pinSheet, setPinSheet] = useState<'setup1' | 'setup2' | 'disable' | null>(null)
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState(false)

  const closePinSheet = () => { setPinSheet(null); setFirstPin(''); setPinError(false) }
  const handleSetup1 = (pin: string) => { setFirstPin(pin); setPinSheet('setup2') }

  const handleSetup2 = async (pin: string) => {
    if (pin !== firstPin) { setPinError(true); return }
    await setPasscode(pin) // 鍵を導出し暗号化を有効化
    closePinSheet()
    // 既存ノート（平文）を暗号化して保存し直す
    try {
      const notes = await storage.getNotes()
      for (const n of notes) await storage.upsertNote(n)
    } catch { /* 失敗分は次回編集時に暗号化される */ }
    showToast('パスコードを設定しました（本文を暗号化）')
  }

  const handleDisable = async (pin: string) => {
    const ok = await verify(pin)
    if (!ok) { setPinError(true); return }
    closePinSheet()
    // 鍵がある間に復号して読み出し → 暗号化解除 → 平文で保存し直す
    let notes: Note[] = []
    try { notes = await storage.getNotes() } catch { /* noop */ }
    removePasscode() // 鍵を破棄し暗号化を無効化
    try { for (const n of notes) await storage.upsertNote(n) } catch { /* noop */ }
    showToast('パスコードを解除しました')
  }

  // 有効化時は暗号化とデータ損失リスクを説明してから設定へ
  async function handleTogglePasscode() {
    if (passcodeEnabled) { setPinSheet('disable'); return }
    const ok = await confirmDialog({
      title: 'パスコードロックと暗号化',
      message: 'パスコードを設定すると、画面ロックに加えてノート本文が端末内で暗号化されます。\n\nパスコードを忘れると復元できません。',
      confirmLabel: '設定する',
    })
    if (ok) setPinSheet('setup1')
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortOrder)?.label ?? ''

  // ---- エクスポート (JSON) ----
  async function handleExport() {
    const notes = (await storage.getNotes()).filter(n => !n.deleted)
    const filename = `simplenote_backup_${new Date().toISOString().slice(0, 10)}.json`
    const ok = await confirmDialog({
      title: 'エクスポート',
      message: `「${filename}」として全ノートを書き出します。よろしいですか？`,
      confirmLabel: '書き出す',
    })
    if (!ok) return
    const blob = new Blob(
      [JSON.stringify({ version: '1', exportedAt: new Date().toISOString(), notes }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    showToast('エクスポートしました')
  }

  // ---- CSV出力 ----
  async function handleExportCsv() {
    const notes = (await storage.getNotes()).filter(n => !n.deleted)
    if (notes.length === 0) { showToast('出力するノートがありません'); return }
    const filename = `simplenote_${new Date().toISOString().slice(0, 10)}.csv`
    const ok = await confirmDialog({
      title: 'CSV出力',
      message: `「${filename}」として全ノートを書き出します。よろしいですか？`,
      confirmLabel: '書き出す',
    })
    if (!ok) return
    const fmt = (ms: number) => new Date(ms).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const rows: string[][] = [
      ['タイトル', '内容', '作成日時', '更新日時', 'ピン止め'],
      ...notes
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(n => [n.title, n.content, fmt(n.createdAt), fmt(n.updatedAt), n.pinned ? 'はい' : 'いいえ']),
    ]
    downloadCsv(rows, filename)
    showToast('CSVを書き出しました')
  }

  // ---- インポート (JSON) ----
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const parsed: unknown = JSON.parse(ev.target?.result as string)
        const raw: unknown[] = Array.isArray(parsed)
          ? parsed
          : ((parsed as Record<string, unknown>).notes as unknown[])
        if (!Array.isArray(raw)) { showToast('無効なファイルです'); return }
        const notes = raw.filter(isValidNote)
        if (notes.length === 0) { showToast('インポートできるノートがありません'); return }
        const ok = await confirmDialog({
          title: 'インポート',
          message: `${file.name}\n\n${notes.length} 件のノートをインポートします。\n同じIDのノートは上書きされます。`,
          confirmLabel: 'インポート',
          danger: true,
        })
        if (!ok) return
        for (const note of notes) {
          await storage.upsertNote({ ...note, version: note.version ?? 1 })
        }
        showToast(`${notes.length} 件をインポートしました`)
      } catch {
        showToast('ファイルの読み込みに失敗しました')
      }
    }
    reader.readAsText(file)
  }

  // ---- ログアウト ----
  // 同一端末を別アカウントで使い回すケースでの混入・漏洩を防ぐため、
  // ログアウト時は端末上のローカルコピー（ノート・パスコード設定）を消去する。
  // クラウド上のデータは削除しない。Context を作り直すためフルリロードする。
  async function handleSignOut() {
    const ok = await confirmDialog({
      title: 'ログアウト',
      message: 'ログアウトしますか？\n\nこの端末に保存されているノートは削除されます（クラウド上のデータは保持されます）。',
      confirmLabel: 'ログアウト',
      danger: true,
    })
    if (!ok) return
    await signOut()
    await storage.clear()
    clearPasscode()
    window.location.href = '/'
  }

  return (
    <>
      {/* バックドロップ */}
      <div
        className={`fixed inset-0 bg-black/30 z-20 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* サイドパネル */}
      <div
        className={`fixed top-0 left-0 h-full w-56 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-30 flex flex-col shadow-xl transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal={open}
        aria-label="メニュー"
        aria-hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        {/* ヘッダー */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100 tracking-tight">LumiNote</span>
        </div>

        {/* メニュー（スクロール可） */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {/* ノート一覧 */}
          <button
            onClick={() => { onViewChange('notes'); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
              view === 'notes' ? 'text-white bg-blue-500' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <IconAllNotes />
            ノート一覧
          </button>

          {/* ゴミ箱 */}
          <button
            onClick={() => { onViewChange('trash'); onClose() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
              view === 'trash' ? 'text-white bg-blue-500' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <IconTrash />
            <span className="flex-1 text-left">ゴミ箱</span>
            {trashCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                view === 'trash' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
              }`}>
                {trashCount}
              </span>
            )}
          </button>

          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />

          {/* 設定トグル */}
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors mb-0.5"
          >
            <IconSettings />
            <span className="flex-1 text-left">設定</span>
            <IconChevron open={settingsOpen} />
          </button>

          {settingsOpen && (
            <div className="ml-3 flex flex-col gap-0.5">

              {/* 並べ替え */}
              <button onClick={() => setSortModalOpen(true)} className={ROW}>
                <span className="text-gray-500 dark:text-gray-400">並べ替え</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-blue-500 dark:text-blue-400 font-medium truncate max-w-[72px]">{currentSortLabel}</span>
                  <IconRight />
                </div>
              </button>

              <div className={DIVIDER} />

              {/* 外観（テーマ） */}
              <p className={SECTION}>外観</p>
              <div className="flex gap-1 px-3 pb-1">
                {THEME_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      theme === value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={DIVIDER} />

              {/* フォントサイズ */}
              <p className={SECTION}>フォントサイズ</p>
              <div className="flex gap-1 px-3 pb-1">
                {FONT_SIZE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFontSize(value)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      fontSize === value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={DIVIDER} />

              {/* データ管理 */}
              <p className={SECTION}>データ管理</p>
              <button onClick={handleExport} className={ROW}>
                <div className="flex items-center gap-2.5"><IconExport />エクスポート</div>
                <IconRight />
              </button>
              <button onClick={() => fileRef.current?.click()} className={ROW}>
                <div className="flex items-center gap-2.5"><IconImport />インポート</div>
                <IconRight />
              </button>
              <button onClick={handleExportCsv} className={ROW}>
                <div className="flex items-center gap-2.5"><IconCsv />CSV出力</div>
                <IconRight />
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

              <div className={DIVIDER} />

              {/* アカウント */}
              {session ? (
                <>
                  <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">{session.user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <IconLogout />
                    ログアウト
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={onClose}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                >
                  <IconLogin />
                  ログインしてクラウド同期
                </Link>
              )}

              <div className={DIVIDER} />

              {/* セキュリティ（パスコードロック） */}
              <p className={SECTION}>セキュリティ</p>
              <button
                onClick={handleTogglePasscode}
                className={ROW}
              >
                <div className="flex items-center gap-2.5"><IconLock />パスコードロック</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  passcodeEnabled
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                }`}>
                  {passcodeEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
              {passcodeEnabled && (
                <button onClick={() => { lock(); onClose() }} className={`${ROW} justify-start gap-2.5`}>
                  <IconLock />
                  今すぐロック
                </button>
              )}
            </div>
          )}
        </nav>

        {/* バージョン情報（固定フッター） */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">LumiNote</p>
          <div className="mt-1 space-y-0.5 text-xs text-gray-400 dark:text-gray-500">
            <div className="flex justify-between"><span>バージョン</span><span>1.0.0</span></div>
            <div className="flex justify-between"><span>プラットフォーム</span><span>Web · Tauri</span></div>
            <div className="flex justify-between"><span>同期</span><span>Supabase</span></div>
          </div>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1.5">© 2026 LumiNote</p>
        </div>
      </div>

      {/* 並べ替えモーダル */}
      {sortModalOpen && (
        <SortModal
          current={sortOrder}
          onSelect={onSortChange}
          onClose={() => setSortModalOpen(false)}
        />
      )}

      {/* パスコード設定モーダル */}
      {pinSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label="パスコード設定"
          onKeyDown={(e) => { if (e.key === 'Escape') closePinSheet() }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={closePinSheet} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl px-8 pt-8 pb-10 w-full max-w-sm shadow-xl">
            <button
              onClick={closePinSheet}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              ✕
            </button>
            {pinSheet === 'setup1' && (
              <PinPad title="新しいパスコードを入力" onComplete={handleSetup1} compact />
            )}
            {pinSheet === 'setup2' && (
              <PinPad
                title="もう一度入力して確認"
                onComplete={handleSetup2}
                error={pinError}
                onErrorReset={() => setPinError(false)}
                compact
              />
            )}
            {pinSheet === 'disable' && (
              <PinPad
                title="現在のパスコードを入力"
                onComplete={handleDisable}
                error={pinError}
                onErrorReset={() => setPinError(false)}
                compact
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
