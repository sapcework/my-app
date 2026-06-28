export type Note = {
  id: string
  title: string
  content: string
  createdAt: number // UNIX ms
  updatedAt: number // UNIX ms
  version: number
  userId?: string
  pinned?: boolean   // ピン止め（updatedAt を変更しない）
  deleted?: boolean  // 論理削除フラグ（ゴミ箱）。同期で削除を伝播させるため物理削除しない
  deletedAt?: number // 削除日時 UNIX ms
}

export interface StorageProvider {
  getNotes(): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  upsertNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  search(query: string): Promise<Note[]>
  subscribe(cb: () => void): () => void
}
