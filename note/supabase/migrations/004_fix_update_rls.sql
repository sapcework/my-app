-- UPDATE 時に user_id を他ユーザーへ書き換える（所有権の付け替え／他ユーザーの一覧への注入）を防ぐ。
-- 既存の update_own は USING のみで WITH CHECK が無く、更新後の user_id を検査していなかった。
drop policy if exists "update_own" on notes;
create policy "update_own" on notes
  for update
  using (auth.uid() = user_id)        -- 自分が所有する行のみ更新可
  with check (auth.uid() = user_id);  -- 更新後も user_id を自分以外へ変更不可
