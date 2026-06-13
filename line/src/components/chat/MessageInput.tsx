'use client';

import { useState, useRef, KeyboardEvent } from 'react';

const STAMPS = ['😂', '😍', '👍', '❤️', '🎉', '😭', '🔥', '✨', '🤣', '😊'];

interface Props {
  onSend: (content: string, type: 'text' | 'stamp') => void;
  onSendImage?: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, onSendImage, disabled }: Props) {
  const [text, setText] = useState('');
  const [showStamps, setShowStamps] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendImage) return;
    if (file.size > 10 * 1024 * 1024) { // 10MB上限
      setSizeError(true);
      setTimeout(() => setSizeError(false), 3000);
      e.target.value = '';
      return;
    }
    setUploading(true);
    await onSendImage(file);
    setUploading(false);
    e.target.value = ''; // 同じファイルを再選択できるようリセット
  };

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim(), 'text');
    setText('');
    setShowStamps(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStamp = (emoji: string) => {
    onSend(emoji, 'stamp');
    setShowStamps(false);
  };

  return (
    <div className="bg-[#f0f0f0] border-t border-gray-200">
      {/* サイズエラー */}
      {sizeError && (
        <p className="text-xs text-red-500 px-4 pt-2">画像は10MB以下にしてください</p>
      )}
      {/* スタンプパレット */}
      {showStamps && (
        <div className="flex flex-wrap gap-2 p-3 bg-white border-b border-gray-200">
          {STAMPS.map((s) => (
            <button
              key={s}
              onClick={() => handleStamp(s)}
              className="text-3xl hover:scale-125 transition-transform active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        {/* スタンプボタン */}
        <button
          onClick={() => setShowStamps((v) => !v)}
          className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-xl transition-colors ${showStamps ? 'bg-[#4CAF50] text-white' : 'bg-white text-gray-500'}`}
        >
          😊
        </button>

        {/* 画像送信ボタン */}
        {onSendImage && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-gray-500 text-lg disabled:opacity-40"
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : '📷'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </>
        )}

        {/* テキスト入力 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          rows={1}
          className="flex-1 resize-none bg-white rounded-2xl px-3 py-2 text-sm outline-none max-h-24 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
        />

        {/* 送信ボタン */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-[#4CAF50] text-white disabled:opacity-40 transition-opacity active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
