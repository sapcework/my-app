-- セキュリティ修正: room_invites の RLS がアプリの権限モデル（招待リンクの作成/削除は
-- owner・adminのみ）より緩く、一般メンバーでも直接REST呼び出しで招待リンクを作成・削除
-- できてしまっていた（Broken Access Control）。
-- room_invites はアプリからは常に service-role の admin API 経由でのみアクセスされ
-- （/api/rooms/[roomId]/invite, /api/rooms/join）、クライアント直接クエリは一切無いため、
-- room_members と同じ方針でクライアントからの直接操作を全面禁止にする。
-- Supabase SQL Editor で実行すること。

DROP POLICY IF EXISTS "members_manage_invites" ON room_invites;
-- 新たなクライアント向けポリシーは作成しない → RLSデフォルト拒否（service_role のみ操作可）
