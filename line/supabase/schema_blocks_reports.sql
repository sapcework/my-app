-- ブロック機能＋通報機能
-- 方針:
--   - user_blocks: ブロック関係（blocker→blocked）。本人の行のみRLSで読み書き可。
--   - DMの新規作成拒否は /api/dm/create（service role）で判定。
--   - 既存DMへのメッセージ送信は BEFORE INSERT トリガーでDBレベル拒否（双方向）。
--     ※ RLSをバイパスして全ブロック行を参照する必要があるため SECURITY DEFINER。
--       ロール判定はしない純粋なデータ参照なので、schema_security.sql の教訓
--       （SECURITY DEFINER内の current_user 判定は不可）には抵触しない。
--   - reports: 通報。一般ユーザーはINSERTのみ（本人が通報者の行）。参照・更新は
--     ポリシーを作らず RLS デフォルト拒否 → 管理者は service role API 経由で閲覧/処理。
-- Supabase SQL Editor で全実行すること。

-- 1. ブロックテーブル
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 自分がブロックした行のみ参照・作成・削除可（誰にブロックされたかは見えない）
DROP POLICY IF EXISTS "user_blocks_select_own" ON user_blocks;
CREATE POLICY "user_blocks_select_own" ON user_blocks FOR SELECT
  USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "user_blocks_insert_own" ON user_blocks;
CREATE POLICY "user_blocks_insert_own" ON user_blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "user_blocks_delete_own" ON user_blocks;
CREATE POLICY "user_blocks_delete_own" ON user_blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- 2. DMメッセージ送信のブロック検査トリガー（双方向・グループは対象外）
CREATE OR REPLACE FUNCTION public.guard_dm_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = NEW.room_id AND is_dm) THEN
    RETURN NEW; -- DM以外は検査しない
  END IF;

  IF EXISTS (
    SELECT 1
    FROM room_members rm
    JOIN user_blocks b
      ON (b.blocker_id = rm.user_id  AND b.blocked_id = NEW.sender_id)  -- 相手が自分をブロック
      OR (b.blocker_id = NEW.sender_id AND b.blocked_id = rm.user_id)   -- 自分が相手をブロック
    WHERE rm.room_id = NEW.room_id AND rm.user_id <> NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'blocked_user' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_dm_block ON public.messages;
CREATE TRIGGER trg_guard_dm_block
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_dm_block();

-- 3. 通報テーブル
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  message_content TEXT NOT NULL DEFAULT '',  -- 元メッセージ削除後も内容を保全
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 一般ユーザーは「自分が通報者」の行のINSERTのみ。SELECT/UPDATE/DELETEはポリシー無し
-- （RLSデフォルト拒否）→ 管理者の閲覧・対応は /api/admin/reports（service role）経由。
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());
