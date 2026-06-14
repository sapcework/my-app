-- ログイン失敗記録テーブル
CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- メール + 時刻での検索を高速化
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup
  ON login_attempts (email, attempted_at DESC);

-- クライアントからのアクセスを完全に禁止（サービスロールのみ）
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
