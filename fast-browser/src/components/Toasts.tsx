import type { Toast } from '../types';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/**
 * 画面下の通知。エラーは assertive、成功・情報は polite で読み上げる。
 * スクリーンリーダー利用者にも操作結果が伝わるようにするため。
 */
export function Toasts({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div id="toast-region">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          role={t.kind === 'error' ? 'alert' : 'status'}
          aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action?.run();
                onDismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="通知を閉じる">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
