-- ルーム単位の通知ミュート（ユーザーごと）
-- Supabase SQL Editor で全実行すること。

CREATE TABLE IF NOT EXISTS public.room_mutes (
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;

-- 本人のみ参照・追加・削除可
DROP POLICY IF EXISTS "room_mutes_manage_own" ON public.room_mutes;
CREATE POLICY "room_mutes_manage_own" ON public.room_mutes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime 配信対象に追加（前景通知の即時反映用。既に追加済みならエラーは無視）
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_mutes;
