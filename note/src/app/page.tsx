'use client'

import { useState } from 'react'
import { NoteList } from '@/components/NoteList'
import { NoteEditor } from '@/components/NoteEditor'

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const showEditor = selectedId !== null

  function handleBack() { setSelectedId(null) }
  function handleDelete() { setSelectedId(null) }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* NoteList: デスクトップは常時表示、モバイルはノート未選択時のみ */}
      <div className={`${showEditor ? 'hidden md:flex' : 'flex'} w-full md:w-64 shrink-0 flex-col`}>
        <NoteList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* NoteEditor: デスクトップは常時表示、モバイルはノート選択時のみ */}
      <div className={`${showEditor ? 'flex' : 'hidden md:flex'} flex-1`}>
        <NoteEditor noteId={selectedId} onDelete={handleDelete} onBack={handleBack} />
      </div>
    </div>
  )
}
