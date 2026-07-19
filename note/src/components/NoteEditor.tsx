'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStorage } from '@/context/StorageContext'
import { useNote } from '@/hooks/useNote'
import { useDebounce } from '@/hooks/useDebounce'
import { useSyncStatus, useManualSync } from '@/hooks/useSyncStatus'
import { useFontSize, FONT_SIZE_CLASS } from '@/hooks/useFontSize'
import { showToast } from '@/lib/toast'
import { deriveTitle } from '@/lib/noteText'
import { PinIcon, BackIcon, InfoIcon, SyncIcon } from '@/components/icons'
import type { Note } from '@/lib/types'

type Props = {
  noteId: string | null
  onDelete: () => void
  onBack: () => void
}

type EditorState = {
  content: string // 明細のみ。タイトルは1行目から自動導出する
}

type SaveStatus = 'saved' | 'saving' | 'error'

const SYNC_LABEL: Record<string, { text: string; color: string }> = {
  offline:  { text: '未ログイン', color: 'text-gray-400' },
  idle:     { text: '同期済み',   color: 'text-green-500' },
  syncing:  { text: '同期中...',  color: 'text-blue-500' },
  error:    { text: '同期エラー', color: 'text-red-500' },
}

const SAVE_LABEL: Record<SaveStatus, { text: string; color: string }> = {
  saved:  { text: '保存済み',   color: 'text-gray-300 dark:text-gray-600' },
  saving: { text: '保存中...',  color: 'text-gray-400 dark:text-gray-500' },
  error:  { text: '保存に失敗しました（編集を続けると再試行します）', color: 'text-red-500' },
}

function formatDateTime(ms: number): string {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function NoteEditor({ noteId, onDelete, onBack }: Props) {
  const storage = useStorage()
  const { updateNote, trashNote, restoreNote, togglePin } = useNote()
  const syncStatus = useSyncStatus()
  const manualSync = useManualSync()
  const { fontSize } = useFontSize()
  const [retrying, setRetrying] = useState(false)
  const [state, setState] = useState<EditorState>({ content: '' })
  const [dates, setDates] = useState<{ createdAt: number; updatedAt: number }>({ createdAt: 0, updatedAt: 0 })
  const [pinned, setPinned] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [showProps, setShowProps] = useState(false)
  const loadedIdRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false) // 読み込み後に実際に編集された場合のみ true
  const contentRef = useRef('')            // 最新の入力内容（flush 用）
  const lastSavedContentRef = useRef('')   // 保存済みの内容（差分がある時だけ flush する）
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const swipeStartXRef = useRef<number | null>(null)

  // 最新の入力内容を ref に同期（flush はイベントハンドラ/クリーンアップから参照する）
  useEffect(() => { contentRef.current = state.content }, [state.content])

  useEffect(() => {
    if (!noteId) {
      setState({ content: '' })
      setDates({ createdAt: 0, updatedAt: 0 })
      return
    }
    storage.getNote(noteId).then((note: Note | null) => {
      // note が null = 未保存の新規ノート。空状態で編集可能にする
      setState({ content: note?.content ?? '' })
      setDates({ createdAt: note?.createdAt ?? Date.now(), updatedAt: note?.updatedAt ?? Date.now() })
      setPinned(note?.pinned ?? false)
      loadedIdRef.current = noteId
      isDirtyRef.current = false // ノート切替時にリセット
      lastSavedContentRef.current = note?.content ?? ''
      // 新規（空）ノートのみ自動フォーカス。既存ノートはキーボードを出さず閲覧優先
      if (!note?.content) setTimeout(() => textareaRef.current?.focus(), 0)
    })
  }, [noteId, storage])

  const debouncedState = useDebounce(state, 500)

  useEffect(() => {
    if (!noteId || loadedIdRef.current !== noteId || !isDirtyRef.current) return
    if (debouncedState.content === lastSavedContentRef.current) return // flush 済みなら二重保存しない
    setSaveStatus('saving')
    // 1行目をタイトルとして保存（検索・並べ替え・一覧表示用）
    updateNote(noteId, { title: deriveTitle(debouncedState.content), content: debouncedState.content })
      .then(() => {
        lastSavedContentRef.current = debouncedState.content
        setDates(d => ({ ...d, updatedAt: Date.now() }))
        setSaveStatus('saved')
      })
      .catch(() => setSaveStatus('error')) // 失敗を握りつぶさず表示（次の編集で再試行される）
  }, [debouncedState]) // eslint-disable-line react-hooks/exhaustive-deps

  // デバウンス待ちの未保存分を即時保存する。
  // 戻る・ノート切替・タブ非表示・アンマウント時に呼び、最後の入力の消失を防ぐ。
  const flushPendingSave = useCallback(() => {
    const id = loadedIdRef.current
    if (!id || !isDirtyRef.current) return
    const content = contentRef.current
    if (content === lastSavedContentRef.current) return
    if (!content.trim()) return // 空ノートは保存しない（戻る時に破棄される）
    lastSavedContentRef.current = content
    updateNote(id, { title: deriveTitle(content), content }).catch(() => {
      showToast('ノートの保存に失敗しました。通信環境を確認してください')
    })
  }, [updateNote])

  // ノート切替・アンマウント時に未保存分を flush（クリーンアップは新ノート読込前に走る）
  useEffect(() => {
    return () => flushPendingSave()
  }, [noteId, flushPendingSave])

  // タブ非表示・ページ離脱時にも flush（モバイルでのアプリ切替対策）
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushPendingSave() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushPendingSave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushPendingSave)
    }
  }, [flushPendingSave])

  // 戻る時、空のノートは破棄する（Simplenote 同様）。保存待ちで遷移をブロックしない
  function handleBack() {
    if (noteId && loadedIdRef.current === noteId && !state.content.trim()) {
      trashNote(noteId).catch(() => {})
    } else {
      flushPendingSave()
    }
    onBack()
  }

  // 削除は確認ダイアログを挟まず即実行し、トーストの「元に戻す」で復元可能にする
  async function handleDelete() {
    if (!noteId) return
    flushPendingSave() // 直前の入力を保存してから削除（復元時に最新内容が戻るように）
    await trashNote(noteId)
    onDelete()
    showToast('ノートを削除しました', {
      actionLabel: '元に戻す',
      onAction: () => { restoreNote(noteId).catch(() => showToast('復元に失敗しました')) },
    })
  }

  // 左端から右へのスワイプで戻る（画面端＝親指で届きやすい）
  function onTouchStart(e: React.TouchEvent) {
    const x = e.touches[0].clientX
    swipeStartXRef.current = x < 30 ? x : null // 左端(30px以内)開始のみ有効
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = swipeStartXRef.current
    swipeStartXRef.current = null
    if (start === null) return
    if (e.changedTouches[0].clientX - start > 80) handleBack() // 右へ80px以上
  }

  if (!noteId) {
    return (
      <div className="flex-1 hidden md:flex items-center justify-center text-gray-300 dark:text-gray-600 bg-white dark:bg-gray-950 select-none">
        ノートを選択するか、新規作成してください
      </div>
    )
  }

  const sync = SYNC_LABEL[syncStatus] ?? SYNC_LABEL.offline
  const save = SAVE_LABEL[saveStatus]

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ヘッダー */}
      <div className="flex items-center px-2 py-2 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={handleBack}
          className="shrink-0 -ml-0.5 mr-1 h-11 pl-1.5 pr-3 flex items-center gap-0.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 active:bg-blue-100 dark:active:bg-blue-950 transition-colors"
          aria-label="一覧に戻る"
        >
          <BackIcon className="w-6 h-6" />
          <span className="text-sm font-medium">戻る</span>
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{deriveTitle(state.content) || '無題のノート'}</span>
        <button
          onClick={async () => { setPinned(v => !v); await togglePin(noteId) }}
          className={`ml-3 shrink-0 transition-colors ${pinned ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'}`}
          aria-label={pinned ? 'ピン止め解除' : 'ピン止め'}
          aria-pressed={pinned}
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
          aria-expanded={showProps}
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
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500 w-14 shrink-0">文字数</span>
            <span className="text-gray-600 dark:text-gray-300">{state.content.length.toLocaleString('ja-JP')} 文字</span>
          </div>
        </div>
      )}

      {/* 明細（1行目がタイトルになる） */}
      <textarea
        ref={textareaRef}
        value={state.content}
        onChange={(e) => { isDirtyRef.current = true; setState({ content: e.target.value }) }}
        placeholder="1行目がタイトルになります。ここに書き始めてください…"
        aria-label="ノート本文"
        className={`note-body flex-1 px-5 md:px-8 pt-5 md:pt-6 pb-4 ${FONT_SIZE_CLASS[fontSize]} text-gray-700 dark:text-gray-200 bg-transparent leading-relaxed outline-none resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600`}
      />

      {/* ステータスバー */}
      <div className="px-4 md:px-8 py-2 flex justify-between items-center gap-3 border-t border-gray-100 dark:border-gray-800">
        <span className={`text-xs truncate ${save.color}`} role="status">{save.text}</span>
        <button
          onClick={handleDelete}
          className="text-xs text-red-300 hover:text-red-500 transition-colors shrink-0"
        >
          削除
        </button>
      </div>
    </div>
  )
}
