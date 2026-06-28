-- 論理削除（ゴミ箱）対応: notes テーブルに deleted / deleted_at カラムを追加
alter table notes add column if not exists deleted boolean not null default false;
alter table notes add column if not exists deleted_at bigint;
