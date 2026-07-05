'use client'

import { useRef, useState } from 'react'
import { useNotes, useSearch, useTrashedNotes } from '@/hooks/useNotes'
import { useNote } from '@/hooks/useNote'
import { useSortOrder, applySortOrder } from '@/hooks/useSortOrder'
import { SideMenu } from '@/components/SideMenu'
import type { ListView } from '@/components/SideMenu'
import { confirmDialog } from '@/lib/dialog'
import { showToast } from '@/lib/toast'
import { deriveTitle, derivePreview } from '@/lib/noteText'
import type { Note } from '@/lib/types'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  // 今日は時刻、それ以外は「月/日」（紛らわしい曜日表示はやめる）
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  if (sameDay) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
  </svg>
)

const HamburgerIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
)

function NoteItem({ note, selected, onClick, onLongPress }: {
  note: Note; selected: boolean; onClick: () => void; onLongPress: () => void
}) {
  const title = deriveTitle(note.content)    // 1行目をタイトル表示
  const preview = derivePreview(note.content) // 2行目以降をプレビュー
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const cancelPress = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  const startPress = (e: React.PointerEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY }
    longPressedRef.current = false
    timerRef.current = setTimeout(() => { longPressedRef.current = true; onLongPress() }, 450)
  }
  const onMove = (e: React.PointerEvent) => {
    // スクロール等で10px以上動いたら長押し判定を取り消す
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancelPress()
  }
  const handleClick = () => {
    if (longPressedRef.current) { longPressedRef.current = false; return } // 長押し直後のクリックは無視
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={onMove}
      onContextMenu={(e) => { e.preventDefault(); cancelPress(); longPressedRef.current = true; onLongPress() }}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none [-webkit-touch-callout:none] ${
        selected ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-400' : ''
      }`}
    >
      <div className="flex justify-between items-baseline gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {note.pinned && <PinIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">
            {title || '無題のノート'}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatDate(note.updatedAt)}</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{preview || '内容なし'}</p>
    </button>
  )
}

function TrashItem({
  note, onRestore, onPurge,
}: { note: Note; onRestore: () => void; onPurge: () => void }) {
  const preview = derivePreview(note.content)
  return (
    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
          {deriveTitle(note.content) || '無題のノート'}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatDate(note.deletedAt ?? note.updatedAt)}</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{preview || '内容なし'}</p>
      <div className="flex gap-3 mt-2">
        <button onClick={onRestore} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
          復元
        </button>
        <button onClick={onPurge} className="text-xs text-red-400 hover:text-red-600 transition-colors">
          完全削除
        </button>
      </div>
    </div>
  )
}

export function NoteList({ selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [view, setView] = useState<ListView>('notes')
  const [actionNote, setActionNote] = useState<Note | null>(null) // 長押し対象
  const allNotes = useNotes()
  const searchResults = useSearch(query)
  const trashed = useTrashedNotes()
  const { createNote, trashNote, restoreNote, deleteNote, emptyTrash, togglePin } = useNote()
  const { sortOrder, setSortOrder } = useSortOrder()

  const notes = query
    ? applySortOrder(searchResults, sortOrder)
    : applySortOrder(allNotes, sortOrder)

  function handleNew() {
    const note = createNote() // 同期的に生成 → 即座にエディタへ（保存は背景）
    onSelect(note.id)
  }

  async function handleRestore(note: Note) {
    await restoreNote(note.id)
    showToast('ノートを復元しました')
  }

  async function handlePurge(note: Note) {
    const ok = await confirmDialog({
      title: '完全に削除',
      message: `「${note.title || '無題のノート'}」を完全に削除します。\nこの操作は取り消せません。`,
      confirmLabel: '完全に削除',
      danger: true,
    })
    if (!ok) return
    await deleteNote(note.id)
    showToast('完全に削除しました')
  }

  // 長押しメニューからの操作
  async function handleSheetPin(note: Note) {
    setActionNote(null)
    await togglePin(note.id)
  }
  async function handleSheetDelete(note: Note) {
    setActionNote(null)
    const ok = await confirmDialog({
      title: 'ノートを削除',
      message: `「${deriveTitle(note.content) || '無題のノート'}」を削除しますか？`,
      confirmLabel: '削除',
      danger: true,
    })
    if (!ok) return
    await trashNote(note.id)
    showToast('ノートを削除しました')
  }

  async function handleEmptyTrash() {
    const ok = await confirmDialog({
      title: 'ゴミ箱を空にする',
      message: `ゴミ箱内の ${trashed.length} 件をすべて完全に削除します。\nこの操作は取り消せません。`,
      confirmLabel: 'すべて削除',
      danger: true,
    })
    if (!ok) return
    await emptyTrash()
    showToast('ゴミ箱を空にしました')
  }

  const hamburger = (
    <button
      onClick={() => setMenuOpen(true)}
      className="shrink-0 w-11 h-11 -ml-1.5 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 active:bg-gray-300 dark:active:bg-gray-700 transition-colors"
      aria-label="メニューを開く"
    >
      <HamburgerIcon />
    </button>
  )

  return (
    <>
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        view={view}
        onViewChange={setView}
        trashCount={trashed.length}
      />

      <aside className="w-full md:w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 h-full">
        {view === 'notes' ? (
          <>
            {/* 検索バー（ハンバーガー付き） */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              {hamburger}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検索..."
                className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            {/* ノート一覧 */}
            <div className="flex-1 overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-8">
                  {query ? '一致するノートなし' : 'ノートがありません'}
                </p>
              ) : (
                notes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    selected={note.id === selectedId}
                    onClick={() => onSelect(note.id)}
                    onLongPress={() => setActionNote(note)}
                  />
                ))
              )}
            </div>

            {/* フッター（デスクトップ用新規ボタンのみ） */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleNew}
                className="hidden md:block w-full py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
              >
                ＋ 新規ノート
              </button>
            </div>

            {/* モバイル用 FAB */}
            <button
              onClick={handleNew}
              className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-500 text-white text-2xl rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors z-10"
              aria-label="新規ノート作成"
            >
              ＋
            </button>
          </>
        ) : (
          <>
            {/* ゴミ箱ヘッダー */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              {hamburger}
              <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">ゴミ箱</span>
              {trashed.length > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  空にする
                </button>
              )}
            </div>

            {/* ゴミ箱一覧 */}
            <div className="flex-1 overflow-y-auto">
              {trashed.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-8">ゴミ箱は空です</p>
              ) : (
                trashed.map((note) => (
                  <TrashItem
                    key={note.id}
                    note={note}
                    onRestore={() => handleRestore(note)}
                    onPurge={() => handlePurge(note)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </aside>

      {/* 長押しアクションシート */}
      {actionNote && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setActionNote(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl pb-2">
            <div className="px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {deriveTitle(actionNote.content) || '無題のノート'}
              </p>
            </div>
            <button
              onClick={() => handleSheetPin(actionNote)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <PinIcon className="w-4 h-4 text-blue-400" />
              {actionNote.pinned ? 'ピン留めを解除' : 'ピン留め'}
            </button>
            <button
              onClick={() => handleSheetDelete(actionNote)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              削除
            </button>
          </div>
        </div>
      )}
    </>
  )
}
