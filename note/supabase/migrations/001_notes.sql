-- notes テーブル
create table if not exists notes (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  created_at  bigint not null,
  updated_at  bigint not null,
  version     int not null default 1
);

-- インデックス（ユーザー別取得 + 更新日時ソート用）
create index if not exists notes_user_id_updated_at on notes (user_id, updated_at desc);

-- RLS 有効化
alter table notes enable row level security;

-- ポリシー：自分のノートのみ参照
create policy "select_own" on notes
  for select using (auth.uid() = user_id);

-- ポリシー：自分の user_id でのみ挿入
create policy "insert_own" on notes
  for insert with check (auth.uid() = user_id);

-- ポリシー：自分のノートのみ更新
create policy "update_own" on notes
  for update using (auth.uid() = user_id);

-- ポリシー：自分のノートのみ削除
create policy "delete_own" on notes
  for delete using (auth.uid() = user_id);
