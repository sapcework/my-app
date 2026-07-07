-- セキュリティ監査対応: Storage バケットのポリシーがバージョン管理外（ダッシュボード手動設定）
-- だったため、SPEC.md記載の仕様（avatars=閲覧全員・自分のフォルダのみ書込／
-- chat-images=非公開）をコードとして明文化する（本番ドリフト防止）。
-- パスは `${userId}/...` 形式を前提とする。
-- Supabase SQL Editor で実行すること。

-- バケットの公開設定を明示（既存設定と同じでも安全に再実行可）
UPDATE storage.buckets SET public = true  WHERE id = 'avatars';     -- アバターは公開前提
UPDATE storage.buckets SET public = false WHERE id = 'chat-images'; -- チャット画像は非公開（署名URLのみ）

-- avatars: 閲覧は全員
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- avatars: アップロードは自分のフォルダのみ
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars: 更新（再アップロード）も自分のフォルダのみ
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars: 削除も自分のフォルダのみ
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
