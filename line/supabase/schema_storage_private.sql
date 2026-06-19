-- chat-images バケットを非公開運用にするための参照ポリシー
-- 画像パスは `${userId}/${roomId}/${ts}.ext` 形式。2番目のフォルダ=roomId で同室判定する。
-- ※ バケットの public フラグ自体は別途 false に変更する（移行スクリプトで実施）。
-- is_room_member（schema_perf.sql）が前提。Supabase SQL Editor で実行すること。

-- ⚠️ 旧「全認証ユーザーが参照可」ポリシーを削除（これが残ると下のメンバー限定がOR評価で無効化される）
DROP POLICY IF EXISTS "chat_images_select_all" ON storage.objects;

DROP POLICY IF EXISTS "chat_images_select_member" ON storage.objects;
CREATE POLICY "chat_images_select_member" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-images'
    AND public.is_room_member( ((storage.foldername(name))[2])::uuid, auth.uid() )
  );

-- アップロード(INSERT)制限: 自分のフォルダ(=[1]) かつ 所属ルーム(=[2]) にのみ可
--   これが無いと、任意の userId/roomId パスへ画像を投入できてしまう（なりすまし・無断投入）。
-- ⚠️ ダッシュボードで作成済みの緩いINSERTポリシー（例: 全認証ユーザー許可）が残っていると
--    RLSはOR評価のため本制限が無効化される。下記で既知の緩いポリシーを名称で削除しておくこと。
--    （独自名で作成している場合は SQL Editor で pg_policies を確認し追加で DROP すること）
DROP POLICY IF EXISTS "chat_images_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "chat_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_images_insert_member" ON storage.objects;
CREATE POLICY "chat_images_insert_member" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text          -- 自分のフォルダのみ
    AND public.is_room_member( ((storage.foldername(name))[2])::uuid, auth.uid() ) -- 所属ルームのみ
  );

-- 後始末(DELETE)制限: 自分がアップロードした画像のみ削除可
DROP POLICY IF EXISTS "chat_images_delete_own" ON storage.objects;
CREATE POLICY "chat_images_delete_own" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
