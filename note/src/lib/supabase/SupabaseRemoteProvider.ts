import type { SupabaseClient } from '@supabase/supabase-js'
import type { RemoteProvider } from '@/lib/sync/SyncEngine'
import type { Note } from '@/lib/types'

type NoteRow = {
  id: string
  user_id: string
  title: string
  content: string
  created_at: number
  updated_at: number
  version: number
  pinned: boolean
  deleted: boolean
  deleted_at: number | null
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    userId: row.user_id,
    pinned: row.pinned,
    deleted: row.deleted,
    deletedAt: row.deleted_at ?? undefined,
  }
}

function fromNote(note: Note): NoteRow {
  return {
    id: note.id,
    user_id: note.userId ?? '',
    title: note.title,
    content: note.content,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    version: note.version,
    pinned: note.pinned ?? false,
    deleted: note.deleted ?? false,
    deleted_at: note.deletedAt ?? null,
  }
}

// SyncEngine からのみ使用すること。UI から直接 import 禁止。
export class SupabaseRemoteProvider implements RemoteProvider {
  constructor(private client: SupabaseClient) {}

  async fetchAll(userId: string): Promise<Note[]> {
    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return (data as NoteRow[]).map(toNote)
  }

  async upsert(note: Note): Promise<void> {
    // remote が新しい場合は上書きしない（古いバックアップのインポートや
    // 競合での巻き戻りによるデータ損失を防ぐ）
    const { data: existing, error: selErr } = await this.client
      .from('notes')
      .select('updated_at')
      .eq('id', note.id)
      .maybeSingle()
    if (selErr) throw selErr
    if (existing && (existing as { updated_at: number }).updated_at > note.updatedAt) return // remote が新しい → skip

    const { error } = await this.client
      .from('notes')
      .upsert(fromNote(note), { onConflict: 'id' })
    if (error) throw error
  }

  async delete(noteId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)
    if (error) throw error
  }
}
