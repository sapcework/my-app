-- グループ機能: ロール・招待リンク

-- 1. room_members に role カラム追加
ALTER TABLE room_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'admin', 'member'));

-- 2. 既存ルームの作成者を owner に昇格
UPDATE room_members rm
SET role = 'owner'
FROM rooms r
WHERE rm.room_id = r.id AND rm.user_id = r.created_by;

-- 3. room_members SELECT: 同じルームのメンバー全員を互いに参照可
DROP POLICY IF EXISTS "room_members_select_member" ON room_members;
CREATE POLICY "room_members_select_same_room" ON room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members AS rm_check
      WHERE rm_check.room_id = room_members.room_id
        AND rm_check.user_id = auth.uid()
    )
  );

-- 4. room_members UPDATE: owner のみ role 変更可（owner 自身は変更不可）
CREATE POLICY "room_members_update_role" ON room_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM room_members AS rm_check
      WHERE rm_check.room_id = room_members.room_id
        AND rm_check.user_id = auth.uid()
        AND rm_check.role = 'owner'
    )
    AND role <> 'owner'
  );

-- 5. room_members DELETE: 退出（自分）または kick（owner/admin が非owner を削除）
DROP POLICY IF EXISTS "room_members_delete_own" ON room_members;
CREATE POLICY "room_members_delete_self_or_privileged" ON room_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      role <> 'owner'
      AND EXISTS (
        SELECT 1 FROM room_members AS rm_check
        WHERE rm_check.room_id = room_members.room_id
          AND rm_check.user_id = auth.uid()
          AND rm_check.role IN ('owner', 'admin')
      )
    )
  );

-- 6. rooms UPDATE: owner/admin のみルーム名変更可
DROP POLICY IF EXISTS "rooms_update_creator" ON rooms;
CREATE POLICY "rooms_update_owner_admin" ON rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = rooms.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- 7. 招待リンクテーブル
CREATE TABLE IF NOT EXISTS room_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_invites_token ON room_invites(token);

ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;

-- メンバーは招待リンクを参照・作成・削除できる
CREATE POLICY "members_manage_invites" ON room_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM room_members WHERE room_id = room_invites.room_id AND user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM room_members WHERE room_id = room_invites.room_id AND user_id = auth.uid())
  );
