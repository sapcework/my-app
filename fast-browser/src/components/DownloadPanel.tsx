import type { Download } from '../types';
import { formatTime } from '../lib/url';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/messages';

interface Props {
  items: Download[];
  onReveal: (d: Download) => void;
  onRemove: (d: Download) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const STATUS_KEY: Record<Download['status'], MessageKey> = {
  running: 'dl.statusRunning',
  done: 'dl.statusDone',
  failed: 'dl.statusFailed',
};

export function DownloadPanel({ items, onReveal, onRemove, onClearAll, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div
      id="download-panel"
      role="dialog"
      aria-label={t('dl.title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="panel-header">
        <h2>{t('dl.title')}</h2>
        <span className="panel-count">{t('history.count', { n: items.length })}</span>
        <button onClick={onClearAll} disabled={items.length === 0} className="panel-action">
          {t('dl.clearList')}
        </button>
        <button onClick={onClose} className="panel-close" aria-label={t('dl.close')}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="panel-body">
        {items.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">{t('dl.emptyTitle')}</p>
            <p className="empty-body">{t('dl.emptyBody')}</p>
          </div>
        ) : (
          items.map((d) => (
            <div key={d.id} className="dl-item">
              <span className={`dl-status dl-${d.status}`} aria-hidden="true">
                {d.status === 'running' ? '↓' : d.status === 'done' ? '✓' : '!'}
              </span>
              <span className="dl-main">
                <span className="dl-name" title={d.path}>
                  {d.file_name}
                </span>
                <span className="dl-meta">
                  {t(STATUS_KEY[d.status])} · {formatTime(d.started_at)}
                </span>
              </span>
              <button
                className="dl-btn"
                onClick={() => onReveal(d)}
                disabled={d.status !== 'done'}
                aria-label={t('dl.openFolderAria', { name: d.file_name })}
              >
                {t('dl.openFolder')}
              </button>
              <button
                className="dl-btn dl-del"
                onClick={() => onRemove(d)}
                aria-label={t('dl.deleteAria', { name: d.file_name })}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && <p className="dl-note">{t('dl.note')}</p>}
    </div>
  );
}
