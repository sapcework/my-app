-- push_subscriptions テーブル（Web Push通知用）
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_push"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- Supabase Webhookの設定手順（ダッシュボード）
-- ==========================================
-- 1. Database → Webhooks → Create new webhook
-- 2. 以下を設定:
--    Name    : push-notification
--    Table   : messages
--    Events  : INSERT
--    URL     : https://line-flax-nine.vercel.app/api/push/send
--    Headers : { "Authorization": "Bearer <SUPABASE_WEBHOOK_SECRET>" }
-- ==========================================
