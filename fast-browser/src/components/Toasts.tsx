import type { Toast } from '../types';
import { useI18n } from '../i18n/context';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

/**
 * 画面下の通知。エラーは assertive、成功・情報は polite で読み上げる。
 * スクリーンリーダー利用者にも操作結果が伝わるようにするため。
 */
export function Toasts({ toasts, onDismiss }: Props) {
  const { t } = useI18n();
  if (toasts.length === 0) return null;
  return (
    <div id="toast-region">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-msg">{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action?.run();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('toast.close')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
