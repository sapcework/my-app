import type { Download } from '../types';
import { formatTime } from '../lib/url';

interface Props {
  items: Download[];
  onReveal: (d: Download) => void;
  onRemove: (d: Download) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<Download['status'], string> = {
  running: 'ダウンロード中',
  done: '完了',
  failed: '失敗',
};

export function DownloadPanel({ items, onReveal, onRemove, onClearAll, onClose }: Props) {
  return (
    <div
      id="download-panel"
      role="dialog"
      aria-label="ダウンロード"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="panel-header">
        <h2>ダウンロード</h2>
        <span className="panel-count">{items.length} 件</span>
        <button onClick={onClearAll} disabled={items.length === 0} className="panel-action">
          一覧を消去
        </button>
        <button onClick={onClose} className="panel-close" aria-label="ダウンロードを閉じる">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="panel-body">
        {items.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">ダウンロードはまだありません</p>
            <p className="empty-body">
              ファイルをダウンロードすると、ここに一覧が表示されます。保存先は OS の
              「ダウンロード」フォルダーです。
            </p>
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
                  {STATUS_LABEL[d.status]} ・ {formatTime(d.started_at)}
                </span>
              </span>
              <button
                className="dl-btn"
                onClick={() => onReveal(d)}
                disabled={d.status !== 'done'}
                aria-label={`${d.file_name} の保存先フォルダーを開く`}
              >
                フォルダーを開く
              </button>
              <button
                className="dl-btn dl-del"
                onClick={() => onRemove(d)}
                aria-label={`${d.file_name} を一覧から削除`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <p className="dl-note">
          「一覧から削除」してもファイル自体は消えません（表示上の履歴のみ消えます）。
        </p>
      )}
    </div>
  );
}
