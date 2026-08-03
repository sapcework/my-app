import { useMemo, useRef, useEffect } from 'react';
import type { HistoryEntry } from '../types';
import { shortUrl, formatTime, matchesQuery } from '../lib/url';
import { useI18n } from '../i18n/context';
import { dayLabelKey } from '../lib/url';

interface Props {
  entries: HistoryEntry[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (url: string) => void;
  onRemove: (entry: HistoryEntry) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function HistoryPanel({
  entries,
  query,
  onQueryChange,
  onOpen,
  onRemove,
  onClearAll,
  onClose,
}: Props) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);

  // 開いた直後に検索へフォーカスを置く（目的の項目へ最短で辿り着けるように）
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // 日付見出しごとにまとめる。件数が増えても走査は1回で済ませる。
  const groups = useMemo(() => {
    const filtered = entries.filter((e) => matchesQuery(e, query));
    const out: { label: string; items: HistoryEntry[] }[] = [];
    for (const e of filtered) {
      const d = dayLabelKey(e.visited_at);
      const label =
        d.kind === 'today'
          ? t('history.today')
          : d.kind === 'yesterday'
            ? t('history.yesterday')
            : d.kind === 'daysAgo'
              ? t('history.daysAgo', { n: d.days })
              : d.text;
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [entries, query, t]);

  const total = entries.length;
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div
      id="history-panel"
      role="dialog"
      aria-modal="false"
      aria-label={t('history.title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div id="history-panel-header">
        <h2 id="history-heading">{t('history.title')}</h2>
        <input
          ref={searchRef}
          id="history-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('history.searchPlaceholder')}
          aria-label={t('history.searchAria')}
          spellCheck={false}
        />
        <span className="history-count" aria-live="polite">
          {query ? t('history.countFiltered', { shown, total }) : t('history.count', { n: total })}
        </span>
        <button
          id="history-clear"
          onClick={onClearAll}
          disabled={total === 0}
          aria-label={t('history.clearAllAria')}
        >
          {t('history.clearAll')}
        </button>
        <button id="history-close" onClick={onClose} aria-label={t('history.close')}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div id="history-list">
        {total === 0 ? (
          <div className="empty-state">
            <p className="empty-title">{t('history.emptyTitle')}</p>
            <p className="empty-body">{t('history.emptyBody')}</p>
          </div>
        ) : shown === 0 ? (
          <div className="empty-state">
            <p className="empty-title">{t('history.noMatchTitle', { query })}</p>
            <button className="link-btn" onClick={() => onQueryChange('')}>
              {t('history.clearFilter')}
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="history-group">{g.label}</h3>
              {g.items.map((h) => {
                const label = h.title || shortUrl(h.url);
                return (
                  <div key={h.id} className="history-item">
                    <button
                      className="history-item-open"
                      onClick={() => onOpen(h.url)}
                      title={h.url}
                    >
                      {h.favicon ? (
                        <img
                          className="history-item-favicon"
                          src={h.favicon}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.visibility = 'hidden';
                          }}
                        />
                      ) : (
                        <span className="history-item-favicon" aria-hidden="true" />
                      )}
                      <span className="history-item-title">{label}</span>
                      <span className="history-item-host">{shortUrl(h.url)}</span>
                      <time
                        className="history-item-time"
                        dateTime={new Date(h.visited_at * 1000).toISOString()}
                      >
                        {formatTime(h.visited_at)}
                      </time>
                    </button>
                    <button
                      className="history-item-del"
                      onClick={() => onRemove(h)}
                      aria-label={t('history.deleteAria', { name: label })}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
