-- room_members を Realtime publication に追加
-- （メンバー追加・退出を即時反映するため。これがないと購読しても発火しない）
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
