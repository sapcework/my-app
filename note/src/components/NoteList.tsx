'use client'

import { useState } from 'react'
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
  const diffDays = Math.floor((now.getTime() - ms) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString('ja-JP', { weekday: 'short' })
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
  </svg>
)

const HamburgerIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

function NoteItem({ note, selected, onClick }: { note: Note; selected: boolean; onClick: () => void }) {
  const title = deriveTitle(note.content)    // 1行目をタイトル表示
  const preview = derivePreview(note.content) // 2行目以降をプレビュー
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        selected ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-400' : ''
      }`}
    >
      <div className="flex justify-between items-baseline gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {note.pinned && <PinIcon className="w-3 h-3 text-blue-400 shrink-0" />}
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
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
  const allNotes = useNotes()
  const searchResults = useSearch(query)
  const trashed = useTrashedNotes()
  const { createNote, restoreNote, deleteNote, emptyTrash } = useNote()
  const { sortOrder, setSortOrder } = useSortOrder()

  const notes = query
    ? applySortOrder(searchResults, sortOrder)
    : applySortOrder(allNotes, sortOrder)

  async function handleNew() {
    const note = await createNote()
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
      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0 p-0.5"
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
    </>
  )
}
