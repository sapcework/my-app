-- chat-images バケットを非公開運用にするための参照ポリシー
-- 画像パスは `${userId}/${roomId}/${ts}.ext` 形式。2番目のフォルダ=roomId で同室判定する。
-- ※ バケットの public フラグ自体は別途 false に変更する（移行スクリプトで実施）。
-- is_room_member（schema_perf.sql）が前提。Supabase SQL Editor で実行すること。

DROP POLICY IF EXISTS "chat_images_select_member" ON storage.objects;
CREATE POLICY "chat_images_select_member" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-images'
    AND public.is_room_member( ((storage.foldername(name))[2])::uuid, auth.uid() )
  );
