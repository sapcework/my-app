-- kakeiboWeb: expenses / categories / budgets / recurring_expenses の RLS ポリシー
--
-- このファイルはコードレビューで発見された「RLSポリシーがコード資産として
-- 管理されておらず実態を検証できない」問題に対応するためのものです。
-- 実行前に Supabase ダッシュボードの Table editor / Authentication > Policies で
-- 既存のポリシーを確認し、重複・矛盾がないことを確認してから
-- SQL Editor で実行してください（このファイルはこのセッションでは実行していません）。
--
-- 前提: 各テーブルに user_id (uuid, auth.users.id を参照) カラムが存在すること。

alter table public.expenses enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;

-- expenses
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

-- categories
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
  for insert with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
  for delete using (auth.uid() = user_id);

-- recurring_expenses
drop policy if exists "recurring_expenses_select_own" on public.recurring_expenses;
create policy "recurring_expenses_select_own" on public.recurring_expenses
  for select using (auth.uid() = user_id);

drop policy if exists "recurring_expenses_insert_own" on public.recurring_expenses;
create policy "recurring_expenses_insert_own" on public.recurring_expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_update_own" on public.recurring_expenses;
create policy "recurring_expenses_update_own" on public.recurring_expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_delete_own" on public.recurring_expenses;
create policy "recurring_expenses_delete_own" on public.recurring_expenses
  for delete using (auth.uid() = user_id);
