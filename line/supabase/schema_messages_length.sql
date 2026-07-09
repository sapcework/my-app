-- セキュリティ強化: メッセージ本文に文字数上限が無く、任意の長さのテキストを
-- 送信できてしまっていた（DB肥大化・描画負荷・嫌がらせ投稿の温床）。
-- クライアント側のmaxLength（MessageInput.tsx）は直接REST呼び出しで回避できるため、
-- DB側でも同じ上限をCHECK制約として強制する。
-- 画像(image)はストレージパス、スタンプ(stamp)は絵文字のためtextのみ対象とする。
-- Supabase SQL Editor で実行すること。

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length_check
  CHECK (type <> 'text' OR char_length(content) <= 2000);
