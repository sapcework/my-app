import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/context';
import { LOCALES, type Locale } from '../i18n/messages';

interface Props {
  zoom: number;
  privateMode: boolean;
  showBmBar: boolean;
  homeUrl: string;
  locale: Locale | '';
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
  onChangeLocale: (locale: Locale | '') => void;
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
    locale,
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
    onChangeLocale,
    onClose,
  } = props;

  // homeUrl が変わったときは App 側の key によりこの要素ごと再マウントされる。
  // そのため effect で state を同期する必要がない（＝余計な再レンダリングを避ける）。
  const { t } = useI18n();
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
      aria-label={t('nav.menu')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="menu-section">
        <button ref={firstRef} className="menu-item" onClick={onNewTab}>
          <span>{t('menu.newTab')}</span>
          <kbd>Ctrl+T</kbd>
        </button>
        <button className="menu-item" onClick={onGoHome}>
          <span>{t('menu.openHome')}</span>
        </button>
        <button className="menu-item" onClick={onOpenFind}>
          <span>{t('menu.find')}</span>
          <kbd>Ctrl+F</kbd>
        </button>
        <button className="menu-item" onClick={onOpenHistory}>
          <span>{t('menu.history')}</span>
          <kbd>Ctrl+H</kbd>
        </button>
        <button className="menu-item" onClick={onOpenDownloads}>
          <span>{t('menu.downloads')}</span>
          <kbd>Ctrl+J</kbd>
        </button>
      </div>

      <div className="menu-section">
        <div className="menu-row">
          <span className="menu-row-label">{t('menu.zoom')}</span>
          <div className="zoom-controls">
            <button onClick={onZoomOut} aria-label={t('menu.zoomOut')}>
              <span aria-hidden="true">−</span>
            </button>
            <button className="zoom-value" onClick={onZoomReset} aria-label={t('menu.zoomReset')}>
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={onZoomIn} aria-label={t('menu.zoomIn')}>
              <span aria-hidden="true">＋</span>
            </button>
          </div>
        </div>
      </div>

      <div className="menu-section">
        <button className="menu-item" onClick={onToggleBmBar} aria-pressed={showBmBar}>
          <span>{t('menu.showBookmarkBar')}</span>
          <span className={`menu-check ${showBmBar ? 'on' : ''}`} aria-hidden="true">
            {showBmBar ? '✓' : ''}
          </span>
        </button>
        <button className="menu-item" onClick={onTogglePrivate} aria-pressed={privateMode}>
          <span>
            {t('menu.privateMode')}
            <small className="menu-note">{t('menu.privateNote')}</small>
          </span>
          <span className={`menu-check ${privateMode ? 'on' : ''}`} aria-hidden="true">
            {privateMode ? '✓' : ''}
          </span>
        </button>
      </div>

      <div className="menu-section">
        <label className="menu-row-label" htmlFor="home-input">
          {t('menu.homePage')}
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
          <button
            className="menu-save"
            onClick={() => onSaveHome(homeDraft.trim())}
            disabled={!homeChanged}
          >
            {t('menu.save')}
          </button>
        </div>
      </div>

      <div className="menu-section">
        <label className="menu-row-label" htmlFor="locale-select">
          {t('menu.language')}
        </label>
        <div className="menu-row">
          <select
            id="locale-select"
            value={locale}
            onChange={(e) => onChangeLocale(e.target.value as Locale | '')}
          >
            <option value="">{t('menu.localeSystem')}</option>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
