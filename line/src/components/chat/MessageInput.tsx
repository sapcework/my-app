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
    e.target.value = '';
  };

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim(), 'text');
    setText('');
    setShowStamps(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // タッチ端末ではEnterは改行（誤送信防止）。PC等のみEnterで送信
    const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isCoarse) {
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
      {/* スタンプパレット */}
      {showStamps && (
        <div className="flex flex-wrap gap-2 p-3 bg-white border-b border-gray-200">
          {STAMPS.map((s) => (
            <button
              key={s}
              onClick={() => handleStamp(s)}
              aria-label={`スタンプ ${s}`}
              className="text-3xl hover:scale-125 transition-transform active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* サイズエラー */}
      {sizeError && (
        <p className="text-xs text-red-500 px-4 pt-2">画像は10MB以下にしてください</p>
      )}

      <div className="flex items-end gap-2 px-2 py-2">
        {/* 画像送信ボタン（左端） */}
        {onSendImage && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              aria-label="画像を送信"
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 disabled:opacity-40"
            >
              {uploading ? (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14l-4-5-3 4-2-2.5L3 19v-2l4-5 3 4 2-2.5L14 17zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                </svg>
              )}
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
          placeholder="メッセージを入力"
          rows={1}
          className="flex-1 resize-none bg-white rounded-2xl px-4 py-2 text-[15px] outline-none max-h-24 overflow-y-auto leading-relaxed"
        />

        {/* スタンプボタン */}
        <button
          onClick={() => setShowStamps((v) => !v)}
          aria-label="スタンプを選択"
          aria-pressed={showStamps}
          className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-xl transition-colors ${showStamps ? 'bg-[#4CAF50] text-white' : 'text-gray-400'}`}
        >
          😊
        </button>

        {/* 送信ボタン */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          aria-label="送信"
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
