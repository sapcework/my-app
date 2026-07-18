export type MessageType = 'text' | 'stamp' | 'image';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  last_seen: string;
  created_at: string;
  is_admin?: boolean;
  is_suspended?: boolean;
}

export interface Room {
  id: string;
  name: string;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  last_message_preview?: string;
  is_dm?: boolean; // 1対1トーク（DM）なら true。表示名は相手ユーザーから動的解決する
  dm_key?: string | null; // DMの参加者2人を昇順連結した正規化キー（二重作成防止の一意制約用）
}

export type MemberRole = 'owner' | 'admin' | 'member';

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
  role: MemberRole;
}

export interface RoomMemberWithUser extends User {
  role: MemberRole;
  joined_at: string;
}

export interface RoomInvite {
  id: string;
  room_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  created_at: string;
  reply_to?: string | null; // 返信先メッセージID
  sender?: User; // joinで取得する場合
}

export interface RoomRead {
  room_id: string;
  user_id: string;
  last_read_message_id: string | null;
  updated_at: string;
}

export interface RoomWithLastMessage extends Room {
  last_message?: Message;
  unread_count?: number;
}

// メッセージの送信状態（UI表示用）
export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface MessageWithStatus extends Message {
  status: MessageStatus;
}

// メッセージへのリアクション（絵文字）
export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}
