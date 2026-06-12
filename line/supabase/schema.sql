-- ユーザーテーブル
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ルームテーブル
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ルームメンバーテーブル
CREATE TABLE room_members (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- メッセージテーブル
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'stamp')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 既読管理テーブル（last_read_message_id方式でO(1)判定）
CREATE TABLE room_reads (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- インデックス
CREATE INDEX idx_messages_room_id_created_at ON messages(room_id, created_at DESC);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_room_reads_room_user ON room_reads(room_id, user_id);
CREATE INDEX idx_users_last_seen ON users(last_seen);

-- last_message_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_room_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rooms SET last_message_at = NEW.created_at WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_last_message_at
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_room_last_message_at();

-- RLS（Row Level Security）有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_reads ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: users
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
-- INSERTはhandle_new_userトリガー（SECURITY DEFINER）のみ許可。直接挿入は不可
CREATE POLICY "users_insert_deny" ON users FOR INSERT WITH CHECK (false);

-- RLSポリシー: rooms（メンバーのみ参照可）
CREATE POLICY "rooms_select_member" ON rooms FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid()));
CREATE POLICY "rooms_select_creator" ON rooms FOR SELECT
  USING (created_by = auth.uid());
CREATE POLICY "rooms_insert_authenticated" ON rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
-- グループ名変更：作成者のみ許可（メンバー全員への開放は意図的に行わない）
CREATE POLICY "rooms_update_creator" ON rooms FOR UPDATE
  USING (created_by = auth.uid());

-- RLSポリシー: room_members
CREATE POLICY "room_members_select_member" ON room_members FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "room_members_insert_authenticated" ON room_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_members_delete_own" ON room_members FOR DELETE
  USING (user_id = auth.uid());

-- RLSポリシー: messages（同じルームのメンバーのみ）
CREATE POLICY "messages_select_member" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_members WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "messages_insert_member" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
  );
-- 自分が送信したメッセージのみ削除可
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- RLSポリシー: room_reads
CREATE POLICY "room_reads_select_member" ON room_reads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = room_reads.room_id AND user_id = auth.uid()
  ));
CREATE POLICY "room_reads_upsert_own" ON room_reads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "room_reads_update_own" ON room_reads FOR UPDATE USING (user_id = auth.uid());

-- authユーザー作成時にusersテーブルへ自動挿入
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
