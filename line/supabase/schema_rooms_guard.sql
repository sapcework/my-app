-- セキュリティ強化: rooms の UPDATE ポリシー(rooms_update_owner_admin)は USING のみで
-- WITH CHECK が無く、更新対象行の判定はできても更新後の値までは制約できていなかった。
-- アプリのUIは name しか更新しないが、直接REST呼び出しで created_by 等も書き換え可能な
-- 状態だったため、既存の guard_user_privilege_cols と同じ方式（JWTロールのみで判定する
-- トリガー）で created_by の変更を service_role 以外に禁止する。
-- Supabase SQL Editor で実行すること。

CREATE OR REPLACE FUNCTION public.guard_room_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  claims   text := current_setting('request.jwt.claims', true);
  jwt_role text;
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    IF claims IS NOT NULL AND claims <> '' THEN
      jwt_role := (claims::json ->> 'role');
      IF jwt_role IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'created_by is not user-modifiable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_room_created_by ON public.rooms;
CREATE TRIGGER trg_guard_room_created_by
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.guard_room_created_by();
