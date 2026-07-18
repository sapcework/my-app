-- DM（1対1トーク）機能
-- 方針: 既存の rooms / room_members / messages をそのまま流用し、DMを
--   「is_dm=true な2人メンバーのルーム」として表現する。専用テーブルは追加しない。
--   DMルームの name は空文字('')で保存し、表示名は相手ユーザーから動的に解決する
--   （相手が改名しても追従できるようにするため）。
-- Supabase SQL Editor で全実行すること。

-- 1. rooms に is_dm フラグを追加（既定は通常ルーム）
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_dm BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. DMルームの検索用インデックス（is_dm=true の行だけを対象にする部分インデックス）
CREATE INDEX IF NOT EXISTS idx_rooms_is_dm ON rooms(is_dm) WHERE is_dm;

-- 注: DMの作成/既存検索は /api/dm/create（service role）が RLS バイパスで実行する。
--     既存の rooms/room_members のRLS・トリガー（guard_room_created_by 等）は変更不要。
