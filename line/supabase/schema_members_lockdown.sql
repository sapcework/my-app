-- セキュリティ強化(#1): room_members の書き込みポリシーを最小化
-- 背景: INSERT が `auth.uid() IS NOT NULL` で緩く、ルームUUIDを知る任意ユーザーが
--   自分を任意ロール(owner含む)で登録できる設計だった。また schema_groups の
--   UPDATE/DELETE ポリシーが自己参照サブクエリで無限再帰の温床になっていた。
-- 方針: メンバー追加/招待/参加/キック/ロール変更は全て service-role の admin API 経由
--   （RLSバイパス）に統一済み。よってクライアント直クエリは「自己退出」のみ許可し、
--   INSERT/UPDATE はクライアントから不可にする。SELECT は schema_perf の
--   is_room_member ベース(再帰なし)を維持。
-- Supabase SQL Editor で全実行すること。

-- 1. room_members の既存 INSERT / UPDATE / DELETE ポリシーを名称非依存で全削除
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'room_members' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.room_members', pol.policyname);
  END LOOP;
END $$;

-- 2. DELETE は「自分自身の退出」のみ（useRooms.leaveRoom が使用）。
--    キックは admin API(service role) が RLS バイパスで実行するため policy 不要。
CREATE POLICY "room_members_delete_self" ON public.room_members FOR DELETE
  USING (user_id = auth.uid());

-- 3. INSERT / UPDATE のクライアント向けポリシーは作成しない
--    → RLS デフォルト拒否。作成/招待/参加/追加/ロール変更は admin API(service role)のみ。

-- 注: SELECT ポリシー(room_members_select_in_my_rooms = is_room_member)は schema_perf のまま維持。
--     ここでは触らないこと（触ると一覧取得が壊れる）。
