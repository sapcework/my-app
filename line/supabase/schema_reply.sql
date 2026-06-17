-- メッセージの返信／引用：返信先メッセージIDを保持する
-- 返信先が削除されたら NULL（引用は消えるが返信自体は残す）
-- Supabase SQL Editor で実行すること。

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL;
