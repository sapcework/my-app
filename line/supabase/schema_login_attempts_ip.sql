-- セキュリティ強化(#2): ログインロックの DoS 緩和
-- 背景: ロックが email 単位のみのため、攻撃者が標的メールにわざと失敗を重ねて
--   正規ユーザーを締め出せた（アカウントロック型DoS）。
-- 方針: 送信元 IP を記録し、ロック判定を (email + ip) 単位に変更する。
--   → 攻撃者(別IP)が失敗を重ねても、正規ユーザー(別IP)はロックされない。
--   → 加えて API 側で IP 単位の総量制限を追加（クレデンシャルスタッフィング緩和）。
-- Supabase SQL Editor で全実行すること。

ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS ip TEXT;

-- (email, ip, 時刻) と (ip, 時刻) の検索を高速化
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip
  ON public.login_attempts (email, ip, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip
  ON public.login_attempts (ip, attempted_at DESC);
