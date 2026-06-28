-- ピン止め機能: notes テーブルに pinned カラムを追加
ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
