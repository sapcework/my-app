-- 不具合修正: schema_room_reads_fk.sql（ON DELETE SET NULL）の副作用対応。
-- 削除されたメッセージが誰かの既読ポインタ(last_read_message_id)だった場合、
-- 単純にNULLへ戻すと「まだ何も既読にしていない」扱いになり、get_unread_counts が
-- そのルームの全メッセージを未読としてカウントしてしまう（未読数の急なスパイク）。
-- 削除前に、そのメッセージより1つ前（同室・作成日時が直前）のメッセージへ
-- 既読ポインタを引き継ぐことで、既読位置を正しく維持したまま削除できるようにする。
-- （それより前のメッセージが無い＝最初のメッセージだった場合はNULLのままでよい）
-- Supabase SQL Editor で実行すること。

CREATE OR REPLACE FUNCTION public.reassign_room_reads_on_message_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.room_reads
  SET last_read_message_id = (
    SELECT id FROM public.messages
    WHERE room_id = OLD.room_id AND created_at < OLD.created_at
    ORDER BY created_at DESC
    LIMIT 1
  )
  WHERE last_read_message_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_room_reads_on_message_delete ON public.messages;
CREATE TRIGGER trg_reassign_room_reads_on_message_delete
  BEFORE DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.reassign_room_reads_on_message_delete();
