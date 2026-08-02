import type { Bookmark } from '../types';
import { shortUrl } from '../lib/url';

interface Props {
  bookmarks: Bookmark[];
  onOpen: (url: string) => void;
  onRemove: (bm: Bookmark) => void;
}

export function BookmarkBar({ bookmarks, onOpen, onRemove }: Props) {
  return (
    <div id="bm-bar" aria-label="ブックマークバー">
      {bookmarks.length === 0 ? (
        <p className="empty-hint">
          ブックマークはまだありません。アドレスバーの <span aria-hidden="true">☆</span> または{' '}
          <kbd>Ctrl</kbd>+<kbd>D</kbd> で追加できます。
        </p>
      ) : (
        bookmarks.map((bm) => {
          const label = bm.title || shortUrl(bm.url);
          return (
            <div key={bm.id} className="bm-chip">
              <button className="bm-chip-open" onClick={() => onOpen(bm.url)} title={bm.url}>
                {label}
              </button>
              <button
                className="bm-chip-del"
                onClick={() => onRemove(bm)}
                aria-label={`ブックマーク ${label} を削除`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
