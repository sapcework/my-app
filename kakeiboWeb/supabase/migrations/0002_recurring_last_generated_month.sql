-- kakeiboWeb: recurring_expenses に自動登録の重複防止用カラムを追加
--
-- 「定期支出」機能をUIの説明どおり実際に毎月自動登録するようにするための変更。
-- クライアント側で「どの月まで自動生成済みか」を記録するためのカラムです。
-- 実行前に Supabase ダッシュボードで recurring_expenses テーブルの現状を確認し、
-- SQL Editor で実行してください（このファイルはこのセッションでは実行していません）。

alter table public.recurring_expenses
  add column if not exists last_generated_month text;
