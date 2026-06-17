'use client';

import { useRef, useState } from 'react';
import { MessageWithStatus, MessageReaction, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { formatMessageTime } from '@/lib/datetime';
import { useSignedUrl } from '@/hooks/useSignedUrl';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']; // クイックリアクション

interface Props {
  message: MessageWithStatus;
  isOwn: boolean;
  isRead: boolean;
  sender?: User;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onReply?: (message: MessageWithStatus) => void;
  replyPreview?: { senderName: string; snippet: string } | null;
  reactions?: MessageReaction[];
  myUserId?: string;
  onReact?: (messageId: string, emoji: string) => void;
  searchQuery?: string;
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-300 text-gray-900 rounded-sm">{part}</mark>
      : part
  );
}

export function MessageBubble({ message, isOwn, isRead, sender, onDelete, onRetry, onReply, replyPreview, reactions = [], myUserId, onReact, searchQuery }: Props) {
  const isStamp = message.type === 'stamp';
  const isImage = message.type === 'image';
  const isFailed = message.status === 'failed';
  const imageUrl = useSignedUrl(message.content, isImage); // 画像は署名URLで表示
  const [showMenu, setShowMenu] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const canDelete = isOwn && !!onDelete && !isFailed; // 送信失敗中は削除でなく再送
  const canInteract = !isFailed && (canDelete || !!onReact || !!onReply); // メニュー（返信/リアクション/削除）を出せるか
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false); // 長押し直後のclick(画像オープン等)を抑制

  // 絵文字ごとに集計（count と自分が押したか）
  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const g = (acc[r.emoji] ??= { count: 0, mine: false });
    g.count += 1;
    if (r.user_id === myUserId) g.mine = true;
    return acc;
  }, {});

  // 長押し（タッチ）でメニュー表示
  const startPress = () => {
    if (!canInteract) return;
    suppressClick.current = false;
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setShowMenu(true);
      navigator.vibrate?.(10);
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canInteract) return;
    e.preventDefault(); // PCの右クリックでメニュー
    setShowMenu(true);
  };
  const handleDelete = () => {
    setShowMenu(false);
    if (confirm('このメッセージを削除しますか？')) onDelete?.(message.id);
  };
  const handleReact = (emoji: string) => {
    setShowMenu(false);
    onReact?.(message.id, emoji);
  };
  const handleReply = () => {
    setShowMenu(false);
    onReply?.(message);
  };

  return (
    <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* アバター（相手のみ） */}
      {!isOwn && <Avatar user={sender} size="sm" />}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* 送信者名（相手のみ） */}
        {!isOwn && sender && (
          <span className="text-xs text-gray-500 mb-0.5 ml-1">{sender.display_name}</span>
        )}

        <div className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* 吹き出し */}
          <div className="relative">
            <div
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onContextMenu={handleContextMenu}
              className={[
                'max-w-full break-words select-none',
                isImage ? '' : 'px-3 py-2',
                isStamp ? 'text-4xl bg-transparent px-0 py-0' : '',
                isFailed ? 'opacity-60 ring-1 ring-red-300' : '',
                !isStamp && !isImage && isOwn
                  ? 'bg-[#4CAF50] text-white rounded-[18px_4px_18px_18px]'
                  : !isStamp && !isImage
                  ? 'bg-white dark:bg-[#262626] text-gray-900 dark:text-gray-100 rounded-[4px_18px_18px_18px] shadow-sm'
                  : '',
              ].join(' ')}
            >
              {/* 引用プレビュー（返信先） */}
              {replyPreview && (
                <div className={`mb-1 pl-2 border-l-2 text-xs rounded-sm ${isOwn ? 'border-white/60 text-white/80' : 'border-gray-300 text-gray-500'}`}>
                  <span className="font-medium">{replyPreview.senderName}</span>
                  <span className="ml-1 opacity-90">{replyPreview.snippet}</span>
                </div>
              )}
              {isImage ? (
                imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="送信された画像"
                    loading="lazy"
                    decoding="async"
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer shadow-sm"
                    onClick={(e) => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } setLightbox(true); }}
                  />
                ) : (
                  <div className="w-[160px] h-[120px] rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                )
              ) : searchQuery ? highlightText(message.content, searchQuery) : message.content}
            </div>
            {/* メニュー（長押し / 右クリックで表示）：リアクション＋削除 */}
            {showMenu && (
              <div className={`absolute bottom-full mb-1 ${isOwn ? 'right-0' : 'left-0'} bg-white dark:bg-[#2a2a2a] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-10`}>
                {/* リアクション絵文字の行 */}
                {onReact && (
                  <div className="flex gap-1 px-2 py-2 border-b border-gray-100">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(emoji)}
                        aria-label={`リアクション ${emoji}`}
                        className="text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-90 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {onReply && (
                  <button
                    onClick={handleReply}
                    className="w-full px-4 py-2 text-sm text-gray-700 font-medium whitespace-nowrap hover:bg-gray-50 text-left"
                  >
                    返信
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-sm text-red-500 font-medium whitespace-nowrap hover:bg-gray-50 text-left border-t border-gray-100"
                  >
                    削除
                  </button>
                )}
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-2 text-sm text-gray-400 whitespace-nowrap hover:bg-gray-50 border-t border-gray-100 text-left"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>

          {/* 時刻＋既読／送信失敗 */}
          <div className={`flex flex-col text-[10px] text-gray-500 flex-shrink-0 ${isOwn ? 'items-end' : 'items-start'}`}>
            {isOwn && (
              isFailed ? (
                <button
                  onClick={() => onRetry?.(message.id)}
                  aria-label="送信に失敗しました。タップで再送"
                  className="text-red-500 font-medium whitespace-nowrap"
                >
                  ⟳ 再送
                </button>
              ) : message.status === 'sending' ? (
                <span
                  aria-label="送信中"
                  className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"
                />
              ) : (
                <span className={isRead ? 'text-[#4CAF50]' : 'text-gray-500'}>
                  {isRead ? '既読' : '✓'}
                </span>
              )
            )}
            {!isFailed && <span>{formatMessageTime(message.created_at)}</span>}
          </div>
        </div>

        {/* リアクションチップ（タップで自分の付与/解除をトグル） */}
        {Object.keys(grouped).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(grouped).map(([emoji, g]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                aria-label={`${emoji} ${g.count}件${g.mine ? '（自分が付与）' : ''}`}
                className={`flex items-center gap-1 px-2 h-6 rounded-full text-xs border ${
                  g.mine ? 'bg-[#4CAF50]/10 border-[#4CAF50] text-[#4CAF50]' : 'bg-white dark:bg-[#2a2a2a] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span>{emoji}</span><span className="font-medium">{g.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 画像ライトボックス（全画面表示・タップで閉じる） */}
      {lightbox && isImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-label="画像プレビュー"
        >
          <img src={imageUrl} alt="画像プレビュー" className="max-w-[95vw] max-h-[90vh] object-contain" />
          <button
            onClick={() => setLightbox(false)}
            aria-label="閉じる"
            className="absolute top-4 right-4 text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
