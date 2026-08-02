import { useEffect, useRef } from 'react';

interface Props {
  query: string;
  total: number;
  index: number; // 1 始まり。0 は該当なし
  onQueryChange: (q: string) => void;
  onStep: (forward: boolean) => void;
  onClose: () => void;
}

/** ページ内検索バー。Enter で次、Shift+Enter で前、Esc で閉じる。 */
export function FindBar({ query, total, index, onQueryChange, onStep, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const noHit = query.trim().length > 0 && total === 0;

  return (
    <div id="find-bar" role="search" aria-label="ページ内検索">
      <label htmlFor="find-input" className="find-label">
        検索
      </label>
      <input
        id="find-input"
        ref={inputRef}
        type="text"
        className={noHit ? 'no-hit' : ''}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onStep(!e.shiftKey);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="ページ内のテキスト"
        spellCheck={false}
        aria-describedby="find-count"
      />
      <span id="find-count" className="find-count" aria-live="polite">
        {query.trim() === '' ? '' : total === 0 ? '見つかりません' : `${index} / ${total}`}
      </span>
      <button onClick={() => onStep(false)} disabled={total === 0} aria-label="前の一致へ">
        <span aria-hidden="true">↑</span>
      </button>
      <button onClick={() => onStep(true)} disabled={total === 0} aria-label="次の一致へ">
        <span aria-hidden="true">↓</span>
      </button>
      <button onClick={onClose} aria-label="検索を閉じる">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
