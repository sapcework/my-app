import type { Bookmark } from '../types';
import { shortUrl } from '../lib/url';
import { useI18n } from '../i18n/context';

interface Props {
  bookmarks: Bookmark[];
  onOpen: (url: string) => void;
  onRemove: (bm: Bookmark) => void;
}

export function BookmarkBar({ bookmarks, onOpen, onRemove }: Props) {
  const { t } = useI18n();
  return (
    <div id="bm-bar" aria-label={t('bm.barAria')}>
      {bookmarks.length === 0 ? (
        <p className="empty-hint">{t('bm.empty')}</p>
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
                aria-label={t('bm.deleteAria', { name: label })}
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
