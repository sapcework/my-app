import { useEffect, useRef, useState } from 'react';

interface Props {
  zoom: number;
  privateMode: boolean;
  showBmBar: boolean;
  homeUrl: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onTogglePrivate: () => void;
  onToggleBmBar: () => void;
  onOpenHistory: () => void;
  onOpenDownloads: () => void;
  onOpenFind: () => void;
  onNewTab: () => void;
  onGoHome: () => void;
  onSaveHome: (url: string) => void;
  onClose: () => void;
}

/**
 * ☰ メニュー。
 *
 * コンテンツ WebView（OS ネイティブの子ビュー）の上には重ねられないため、
 * 一般的なポップオーバーではなく chrome の高さを使うパネルとして描画する。
 */
export function AppMenu(props: Props) {
  const {
    zoom,
    privateMode,
    showBmBar,
    homeUrl,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onTogglePrivate,
    onToggleBmBar,
    onOpenHistory,
    onOpenDownloads,
    onOpenFind,
    onNewTab,
    onGoHome,
    onSaveHome,
    onClose,
  } = props;

  // homeUrl が変わったときは App 側の key によりこの要素ごと再マウントされる。
  // そのため effect で state を同期する必要がない（＝余計な再レンダリングを避ける）。
  const [homeDraft, setHomeDraft] = useState(homeUrl);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const homeChanged = homeDraft.trim() !== homeUrl;

  return (
    <div
      id="app-menu"
      role="dialog"
      aria-label="メニュー"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="menu-section">
        <button ref={firstRef} className="menu-item" onClick={onNewTab}>
          <span>新しいタブ</span>
          <kbd>Ctrl+T</kbd>
        </button>
        <button className="menu-item" onClick={onGoHome}>
          <span>ホームページを開く</span>
        </button>
        <button className="menu-item" onClick={onOpenFind}>
          <span>ページ内を検索</span>
          <kbd>Ctrl+F</kbd>
        </button>
        <button className="menu-item" onClick={onOpenHistory}>
          <span>履歴</span>
          <kbd>Ctrl+H</kbd>
        </button>
        <button className="menu-item" onClick={onOpenDownloads}>
          <span>ダウンロード</span>
          <kbd>Ctrl+J</kbd>
        </button>
      </div>

      <div className="menu-section">
        <div className="menu-row">
          <span className="menu-row-label">ズーム</span>
          <div className="zoom-controls">
            <button onClick={onZoomOut} aria-label="縮小 (Ctrl+-)">
              <span aria-hidden="true">−</span>
            </button>
            <button className="zoom-value" onClick={onZoomReset} aria-label="ズームをリセット (Ctrl+0)">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={onZoomIn} aria-label="拡大 (Ctrl++)">
              <span aria-hidden="true">＋</span>
            </button>
          </div>
        </div>
      </div>

      <div className="menu-section">
        <button className="menu-item" onClick={onToggleBmBar} aria-pressed={showBmBar}>
          <span>ブックマークバーを表示</span>
          <span className={`menu-check ${showBmBar ? 'on' : ''}`} aria-hidden="true">
            {showBmBar ? '✓' : ''}
          </span>
        </button>
        <button className="menu-item" onClick={onTogglePrivate} aria-pressed={privateMode}>
          <span>
            プライベートモード
            <small className="menu-note">オンの間は履歴を残しません</small>
          </span>
          <span className={`menu-check ${privateMode ? 'on' : ''}`} aria-hidden="true">
            {privateMode ? '✓' : ''}
          </span>
        </button>
      </div>

      <div className="menu-section">
        <label className="menu-row-label" htmlFor="home-input">
          ホームページ
        </label>
        <div className="menu-row">
          <input
            id="home-input"
            type="text"
            value={homeDraft}
            onChange={(e) => setHomeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && homeChanged) onSaveHome(homeDraft.trim());
            }}
            spellCheck={false}
            placeholder="https://example.com"
          />
          <button className="menu-save" onClick={() => onSaveHome(homeDraft.trim())} disabled={!homeChanged}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
