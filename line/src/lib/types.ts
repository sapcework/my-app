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
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  created_at: string;
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
export type MessageStatus = 'sending' | 'sent' | 'read';

export interface MessageWithStatus extends Message {
  status: MessageStatus;
}
