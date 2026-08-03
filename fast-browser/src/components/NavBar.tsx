import { forwardRef } from 'react';
import { ENGINES, type EngineId, isSecure, splitUrlForDisplay } from '../lib/url';
import { useI18n } from '../i18n/context';

interface Props {
  address: string;
  focused: boolean;
  bookmarked: boolean;
  engine: EngineId;
  showMenu: boolean;
  showHistory: boolean;
  privateMode: boolean;
  onAddressChange: (v: string) => void;
  onSubmit: () => void;
  onRequestFocus: () => void;
  onBlur: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleBookmark: () => void;
  onToggleMenu: () => void;
  onToggleHistory: () => void;
  onEngineChange: (e: EngineId) => void;
}

/**
 * ナビゲーションバー。
 *
 * アドレス表示は「未フォーカス時は装飾テキスト、フォーカス時は input」に切り替える。
 * 以前はホスト名しか表示していなかったため、実際に開いているパスが分からず
 * フィッシングの判別もできなかった。今はフル URL を出しつつ、
 * 接続先ホストだけを強調して視線が最初にそこへ向くようにしている。
 */
export const NavBar = forwardRef<HTMLInputElement, Props>(function NavBar(props, ref) {
  const {
    address,
    focused,
    bookmarked,
    engine,
    showMenu,
    showHistory,
    privateMode,
    onAddressChange,
    onSubmit,
    onRequestFocus,
    onBlur,
    onBack,
    onForward,
    onReload,
    onToggleBookmark,
    onToggleMenu,
    onToggleHistory,
    onEngineChange,
  } = props;

  const { t } = useI18n();
  const secure = isSecure(address);
  const { prefix, host, rest } = splitUrlForDisplay(address);

  return (
    <div id="nav-bar">
      <button className="nav-btn" onClick={onBack} aria-label={t('nav.back')}>
        <span aria-hidden="true">&#8249;</span>
      </button>
      <button className="nav-btn" onClick={onForward} aria-label={t('nav.forward')}>
        <span aria-hidden="true">&#8250;</span>
      </button>
      <button className="nav-btn" onClick={onReload} aria-label={t('nav.reload')}>
        <span aria-hidden="true">&#8635;</span>
      </button>

      <div id="address-wrapper" className={focused ? 'focused' : ''}>
        <span
          className={`secure-icon ${secure ? 'secure' : 'insecure'}`}
          role="img"
          aria-label={secure ? t('nav.secure') : t('nav.insecure')}
          title={secure ? t('nav.secure') : t('nav.insecureHint')}
        >
          <span aria-hidden="true">{secure ? '🔒' : '⚠'}</span>
        </span>

        {focused ? (
          <input
            id="address-bar"
            ref={ref}
            type="text"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              } else if (e.key === 'Escape') {
                e.currentTarget.blur();
              }
            }}
            onBlur={onBlur}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            aria-label={t('nav.addressAria')}
            placeholder={t('nav.addressPlaceholder')}
          />
        ) : (
          <button
            id="address-display"
            onClick={onRequestFocus}
            onFocus={onRequestFocus}
            aria-label={t('nav.addressDisplayAria', { url: address })}
            title={address}
          >
            <span className="url-dim">{prefix}</span>
            <span className="url-host">{host}</span>
            <span className="url-dim">{rest}</span>
          </button>
        )}

        <button
          id="bm-star"
          className={bookmarked ? 'active' : ''}
          onClick={onToggleBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? t('nav.bookmarkRemove') : t('nav.bookmarkAdd')}
        >
          <span aria-hidden="true">{bookmarked ? '★' : '☆'}</span>
        </button>
      </div>

      {privateMode && (
        <span id="private-badge" title={t('nav.privateHint')}>
          <span aria-hidden="true">🕶</span> {t('nav.private')}
        </span>
      )}

      <button
        id="history-toggle"
        className={`nav-btn ${showHistory ? 'active' : ''}`}
        onClick={onToggleHistory}
        aria-pressed={showHistory}
        aria-label={t('nav.history')}
      >
        <span aria-hidden="true">🕘</span>
      </button>

      <button
        id="menu-toggle"
        className={`nav-btn ${showMenu ? 'active' : ''}`}
        onClick={onToggleMenu}
        aria-expanded={showMenu}
        aria-haspopup="dialog"
        aria-label={t('nav.menu')}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <select
        id="engine-select"
        value={engine}
        onChange={(e) => onEngineChange(e.target.value as EngineId)}
        aria-label={t('nav.engine')}
      >
        {ENGINES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
});
