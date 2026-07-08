-- 不具合修正: room_reads.last_read_message_id の外部キーに ON DELETE が
-- 指定されておらず、削除しようとしたメッセージが誰かの既読ポインタになっていると
-- 削除がブロックされていた（特に最新メッセージは誰かの既読ポインタになりやすく、
-- 管理者画面での削除・本人によるメッセージ削除が「削除に失敗しました」になる原因）。
-- reply_to（schema_reply.sql）と同様に ON DELETE SET NULL にする
-- （既読ポインタは単にリセットされ、次の既読更新で再度更新される。NULLはコード側で
--  「未読扱い」として安全に処理済み＝useReadStatus.getOtherLastRead）。
-- Supabase SQL Editor で実行すること。

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.room_reads'::regclass
      AND confrelid = 'public.messages'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.room_reads DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.room_reads
  ADD CONSTRAINT room_reads_last_read_message_id_fkey
  FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
