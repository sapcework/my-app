-- セキュリティ修正: users テーブルの権限昇格・他人行改ざんを封じる
-- 監査で確認した CRITICAL（一般ユーザーが is_admin=true への自己昇格、
-- および他人の display_name 等を改ざん可能）への対処。
-- Supabase SQL Editor で全実行すること。

-- 1. users の既存 UPDATE ポリシーを名称に依存せず全て削除（本番ドリフト対策）
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- 2. UPDATE は「自分の行」のみ（USING と WITH CHECK 両方で id を固定）
--    ※ 列の保護は WITH CHECK では不可能なため 3. のトリガーで担保する
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. is_admin / is_suspended は本人でも変更不可（service_role / DB管理ロールのみ許可）
--    判定は JWT ロールのみで行う（current_user は SECURITY DEFINER 等で所有者に化けるため使わない）：
--      - request.jwt.claims が空        → SQL Editor / 管理者DDL → 許可
--      - JWT role = 'service_role'      → APIルートの admin クライアント → 許可
--      - それ以外（authenticated/anon） → 一般ユーザー → 拒否
CREATE OR REPLACE FUNCTION public.guard_user_privilege_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  claims   text := current_setting('request.jwt.claims', true);
  jwt_role text;
BEGIN
  IF (NEW.is_admin     IS DISTINCT FROM OLD.is_admin)
     OR (NEW.is_suspended IS DISTINCT FROM OLD.is_suspended) THEN
    IF claims IS NOT NULL AND claims <> '' THEN
      jwt_role := (claims::json ->> 'role');
      IF jwt_role IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'privileged columns (is_admin/is_suspended) are not user-modifiable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_privilege_cols ON public.users;
CREATE TRIGGER trg_guard_user_privilege_cols
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_privilege_cols();
