'use client'

import { useEffect, useRef, useState } from 'react'
import { useStorage } from '@/context/StorageContext'
import { useNote } from '@/hooks/useNote'
import { useDebounce } from '@/hooks/useDebounce'
import { useSyncStatus, useManualSync } from '@/hooks/useSyncStatus'
import { useFontSize, FONT_SIZE_CLASS } from '@/hooks/useFontSize'
import { confirmDialog } from '@/lib/dialog'
import { showToast } from '@/lib/toast'
import { deriveTitle } from '@/lib/noteText'
import type { Note } from '@/lib/types'

type Props = {
  noteId: string | null
  onDelete: () => void
  onBack: () => void
}

type EditorState = {
  content: string // 明細のみ。タイトルは1行目から自動導出する
}

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
  </svg>
)

const SYNC_LABEL: Record<string, { text: string; color: string }> = {
  offline:  { text: '未ログイン', color: 'text-gray-400' },
  idle:     { text: '同期済み',   color: 'text-green-500' },
  syncing:  { text: '同期中...',  color: 'text-blue-500' },
  error:    { text: '同期エラー', color: 'text-red-500' },
}

// 同期状態アイコン（絵文字をやめて SVG に統一）
const SyncIcon = ({ status, className }: { status: string; className?: string }) => {
  const cls = `${className ?? 'w-3.5 h-3.5'}`
  if (status === 'syncing') return (
    <svg className={`${cls} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  )
  if (status === 'idle') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 100-9h-1.8A7 7 0 104 14.9"/>
      <polyline points="9 13 11 15 15 11"/>
    </svg>
  )
  if (status === 'error') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  return ( // offline
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19a4.5 4.5 0 100-9h-1.8A7 7 0 104 14.9"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  )
}

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)

function formatDateTime(ms: number): string {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function NoteEditor({ noteId, onDelete, onBack }: Props) {
  const storage = useStorage()
  const { updateNote, trashNote, togglePin } = useNote()
  const syncStatus = useSyncStatus()
  const manualSync = useManualSync()
  const { fontSize } = useFontSize()
  const [retrying, setRetrying] = useState(false)
  const [state, setState] = useState<EditorState>({ content: '' })
  const [dates, setDates] = useState<{ createdAt: number; updatedAt: number }>({ createdAt: 0, updatedAt: 0 })
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProps, setShowProps] = useState(false)
  const loadedIdRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false) // 読み込み後に実際に編集された場合のみ true
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!noteId) {
      setState({ content: '' })
      setDates({ createdAt: 0, updatedAt: 0 })
      return
    }
    storage.getNote(noteId).then((note: Note | null) => {
      if (!note) return
      setState({ content: note.content })
      setDates({ createdAt: note.createdAt, updatedAt: note.updatedAt })
      setPinned(note.pinned ?? false)
      loadedIdRef.current = noteId
      isDirtyRef.current = false // ノート切替時にリセット
      // 新規（空）ノートのみ自動フォーカス。既存ノートはキーボードを出さず閲覧優先
      if (note.content === '') setTimeout(() => textareaRef.current?.focus(), 0)
    })
  }, [noteId, storage])

  const debouncedState = useDebounce(state, 500)

  useEffect(() => {
    if (!noteId || loadedIdRef.current !== noteId || !isDirtyRef.current) return
    setSaving(true)
    // 1行目をタイトルとして保存（検索・並べ替え・一覧表示用）
    updateNote(noteId, { title: deriveTitle(debouncedState.content), content: debouncedState.content })
      .then(() => setDates(d => ({ ...d, updatedAt: Date.now() })))
      .finally(() => setSaving(false))
  }, [debouncedState]) // eslint-disable-line react-hooks/exhaustive-deps

  // 戻る時、空のノートは破棄する（Simplenote 同様）
  async function handleBack() {
    if (noteId && loadedIdRef.current === noteId && !state.content.trim()) {
      await trashNote(noteId)
    }
    onBack()
  }

  if (!noteId) {
    return (
      <div className="flex-1 hidden md:flex items-center justify-center text-gray-300 dark:text-gray-600 bg-white dark:bg-gray-950 select-none">
        ノートを選択するか、新規作成してください
      </div>
    )
  }

  const sync = SYNC_LABEL[syncStatus] ?? SYNC_LABEL.offline

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950">
      {/* ヘッダー */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={handleBack}
          className="text-blue-500 text-sm mr-3 shrink-0"
          aria-label="一覧に戻る"
        >
          ← 戻る
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{deriveTitle(state.content) || '無題のノート'}</span>
        <button
          onClick={async () => { setPinned(v => !v); await togglePin(noteId) }}
          className={`ml-3 shrink-0 transition-colors ${pinned ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'}`}
          aria-label={pinned ? 'ピン止め解除' : 'ピン止め'}
        >
          <PinIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowProps(v => !v)}
          className={`ml-2 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            showProps
              ? 'text-blue-500 bg-blue-50 dark:bg-blue-950/50'
              : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          aria-label="プロパティ"
        >
          <InfoIcon className="w-5 h-5" />
        </button>
      </div>

      {/* プロパティパネル */}
      {showProps && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500 w-14 shrink-0">同期状態</span>
            <span className={`flex items-center gap-1.5 ${sync.color}`}>
              <SyncIcon status={syncStatus} />
              {sync.text}
            </span>
            {syncStatus === 'error' && (
              <button
                onClick={async () => { setRetrying(true); await manualSync(); setRetrying(false) }}
                disabled={retrying}
                className="ml-auto text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
              >
                {retrying ? '再試行中...' : '再同期'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500 w-14 shrink-0">更新日</span>
            <span className="text-gray-600 dark:text-gray-300">{formatDateTime(dates.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500 w-14 shrink-0">作成日</span>
            <span className="text-gray-600 dark:text-gray-300">{formatDateTime(dates.createdAt)}</span>
          </div>
        </div>
      )}

      {/* 明細（1行目がタイトルになる） */}
      <textarea
        ref={textareaRef}
        value={state.content}
        onChange={(e) => { isDirtyRef.current = true; setState({ content: e.target.value }) }}
        placeholder="1行目がタイトルになります。ここに書き始めてください…"
        className={`note-body flex-1 px-5 md:px-8 pt-5 md:pt-6 pb-4 ${FONT_SIZE_CLASS[fontSize]} text-gray-700 dark:text-gray-200 bg-transparent leading-relaxed outline-none resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600`}
      />

      {/* ステータスバー */}
      <div className="px-4 md:px-8 py-2 flex justify-between items-center border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-300 dark:text-gray-600">{saving ? '保存中...' : '保存済み'}</span>
        <button
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'ノートを削除',
              message: 'このノートを削除しますか？',
              confirmLabel: '削除',
              danger: true,
            })
            if (!ok) return
            await trashNote(noteId)
            onDelete()
            showToast('ノートを削除しました')
          }}
          className="text-xs text-red-300 hover:text-red-500 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  )
}
