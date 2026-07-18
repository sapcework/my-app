-- DMの二重作成防止：参加者2人の正規化キー(dm_key)＋部分ユニークインデックス
-- 背景: /api/dm/create は「検索→無ければ作成」だがDB制約が無く、同時タップや
--   同時相互作成で二重DMルームが生成され得た。参加者UUIDを昇順連結したキーを
--   rooms に持たせ、is_dm 行のみ一意にすることで根本的に防ぐ。
-- Supabase SQL Editor で全実行すること。

-- 1. dm_key 列を追加（DM以外は NULL のまま）
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS dm_key TEXT;

-- 2. 既存DMルームのバックフィル（メンバーのUUIDを昇順で ':' 連結）
UPDATE rooms r
SET dm_key = sub.k
FROM (
  SELECT rm.room_id,
         string_agg(rm.user_id::text, ':' ORDER BY rm.user_id) AS k
  FROM room_members rm
  JOIN rooms r2 ON r2.id = rm.room_id AND r2.is_dm
  GROUP BY rm.room_id
) sub
WHERE r.id = sub.room_id AND r.is_dm;

-- 3. 【重要】既存の重複DMが無いか確認（あるとステップ4のインデックス作成が失敗する）。
--    以下を実行して0件であることを確認してからステップ4へ進むこと。
--    重複が出た場合は、残す1件を決めて他方を手動で DELETE（メッセージも消える点に注意）。
--
--   SELECT dm_key, count(*), array_agg(id) AS room_ids
--   FROM rooms WHERE is_dm AND dm_key IS NOT NULL
--   GROUP BY dm_key HAVING count(*) > 1;

-- 4. is_dm 行のみを対象にした部分ユニークインデックス（以後の二重作成を封じる）
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_dm_key ON rooms(dm_key) WHERE is_dm;
