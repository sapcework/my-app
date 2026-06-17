-- アカウント削除（退会）: 関連データを整合的に削除する関数
-- FK制約（messages.sender_id / rooms.created_by / room_reads.last_read_message_id は
-- ON DELETE CASCADE が無い）を考慮し、正しい順序で削除する。
-- room_members / room_reads / push_subscriptions / room_invites は users への CASCADE で自動削除。
-- Supabase SQL Editor で全実行すること。

CREATE OR REPLACE FUNCTION public.delete_user_account(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 他ユーザーの既読参照が本人のメッセージを指している場合に備えて先に外す
  UPDATE room_reads
    SET last_read_message_id = NULL
    WHERE last_read_message_id IN (SELECT id FROM messages WHERE sender_id = p_uid);

  -- 本人の送信メッセージを削除
  DELETE FROM messages WHERE sender_id = p_uid;

  -- 本人が作成したルームは作成者を外す（グループ自体は残す）
  UPDATE rooms SET created_by = NULL WHERE created_by = p_uid;

  -- users 行削除（room_members / room_reads / push_subscriptions / room_invites は CASCADE）
  DELETE FROM users WHERE id = p_uid;
END;
$$;

-- service_role（APIの admin クライアント）以外からは実行不可にする
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
