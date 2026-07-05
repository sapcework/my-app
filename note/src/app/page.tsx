'use client'

import { useEffect, useRef, useState } from 'react'
import { NoteList } from '@/components/NoteList'
import { NoteEditor } from '@/components/NoteEditor'

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const showEditor = selectedId !== null
  const pushedRef = useRef(false) // 履歴エントリを積んでいるか

  // ノートを開く。履歴に1つ積んで、Android/ブラウザの戻るで一覧へ戻れるようにする
  function openNote(id: string) {
    if (!pushedRef.current) {
      window.history.pushState({ noteOpen: true }, '')
      pushedRef.current = true
    }
    setSelectedId(id)
  }

  // 一覧へ戻る。積んだ履歴があれば戻る（popstate 経由で閉じる）
  function closeNote() {
    if (pushedRef.current) {
      window.history.back()
    } else {
      setSelectedId(null)
    }
  }

  // Android の戻る（ジェスチャー/ボタン）= popstate でエディタを閉じる
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false
      setSelectedId(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* NoteList: デスクトップは常時表示、モバイルはノート未選択時のみ */}
      <div className={`${showEditor ? 'hidden md:flex' : 'flex'} w-full md:w-64 shrink-0 flex-col`}>
        <NoteList selectedId={selectedId} onSelect={openNote} />
      </div>

      {/* NoteEditor: デスクトップは常時表示、モバイルはノート選択時のみ */}
      <div className={`${showEditor ? 'flex' : 'hidden md:flex'} flex-1`}>
        <NoteEditor noteId={selectedId} onDelete={closeNote} onBack={closeNote} />
      </div>
    </div>
  )
}
