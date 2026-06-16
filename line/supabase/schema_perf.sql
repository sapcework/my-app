-- パフォーマンス最適化: 読み取りを直接クエリに戻すための RLS 整理
-- （メンバー一覧を「同室メンバーが互いに参照可」にしつつ、無限再帰を回避）

-- 1. SECURITY DEFINER 関数でメンバー判定（RLSをバイパスするため再帰しない）
--    ※ Supabase SQL Editor で実行すると owner=postgres となり room_members の RLS を回避する
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

-- 2. room_members SELECT: 自分が所属するルームの全メンバーを参照可（関数経由で再帰回避）
DROP POLICY IF EXISTS "room_members_select_member" ON room_members;
DROP POLICY IF EXISTS "room_members_select_same_room" ON room_members;
CREATE POLICY "room_members_select_in_my_rooms" ON room_members FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));

-- 3. rooms SELECT: メンバーのルーム + 作成したルーム（関数経由で軽量化）
DROP POLICY IF EXISTS "rooms_select_member" ON rooms;
CREATE POLICY "rooms_select_member" ON rooms FOR SELECT
  USING (public.is_room_member(id, auth.uid()));
-- 作成者は退出後も参照可（既存の rooms_select_creator はそのまま）

-- 4. messages SELECT: 同室メンバーのみ（関数経由）
DROP POLICY IF EXISTS "messages_select_member" ON messages;
CREATE POLICY "messages_select_member" ON messages FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));

-- 5. messages INSERT: 送信者本人かつ同室メンバー（関数経由）
DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));

-- 6. room_reads SELECT: 同室メンバー（関数経由）
DROP POLICY IF EXISTS "room_reads_select_member" ON room_reads;
CREATE POLICY "room_reads_select_member" ON room_reads FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));
