-- メッセージへのリアクション（絵文字）
-- Supabase SQL Editor で全実行すること。is_room_member（schema_perf.sql）が前提。

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)  -- 同一ユーザー・同一絵文字は1つ
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_room ON public.message_reactions(room_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
-- DELETE の postgres_changes で room_id フィルタを効かせるため全列を old に含める
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- 同室メンバーは参照可、本人のみ付与/解除可
DROP POLICY IF EXISTS "reactions_select" ON public.message_reactions;
CREATE POLICY "reactions_select" ON public.message_reactions FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "reactions_insert" ON public.message_reactions;
CREATE POLICY "reactions_insert" ON public.message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "reactions_delete" ON public.message_reactions;
CREATE POLICY "reactions_delete" ON public.message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Realtime 配信対象に追加（既に追加済みならエラーは無視してよい）
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
