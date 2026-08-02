import { forwardRef } from 'react';
import { ENGINES, type EngineId, isSecure, splitUrlForDisplay } from '../lib/url';

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

  const secure = isSecure(address);
  const { prefix, host, rest } = splitUrlForDisplay(address);

  return (
    <div id="nav-bar">
      <button className="nav-btn" onClick={onBack} aria-label="前のページに戻る (Alt+←)">
        <span aria-hidden="true">&#8249;</span>
      </button>
      <button className="nav-btn" onClick={onForward} aria-label="次のページに進む (Alt+→)">
        <span aria-hidden="true">&#8250;</span>
      </button>
      <button className="nav-btn" onClick={onReload} aria-label="再読み込み (Ctrl+R)">
        <span aria-hidden="true">&#8635;</span>
      </button>

      <div id="address-wrapper" className={focused ? 'focused' : ''}>
        <span
          className={`secure-icon ${secure ? 'secure' : 'insecure'}`}
          role="img"
          aria-label={secure ? '保護された接続' : '保護されていない接続'}
          title={secure ? '保護された接続' : '保護されていない接続 — 情報を入力しないでください'}
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
            aria-label="アドレスバー — URL または検索語を入力"
            placeholder="URL またはキーワードを入力"
          />
        ) : (
          <button
            id="address-display"
            onClick={onRequestFocus}
            onFocus={onRequestFocus}
            aria-label={`現在のアドレス ${address}。編集するには Enter または Ctrl+L`}
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
          aria-label={
            bookmarked ? 'このページのブックマークを解除 (Ctrl+D)' : 'このページをブックマーク (Ctrl+D)'
          }
        >
          <span aria-hidden="true">{bookmarked ? '★' : '☆'}</span>
        </button>
      </div>

      {privateMode && (
        <span id="private-badge" title="プライベートモード — 履歴を残していません">
          <span aria-hidden="true">🕶</span> プライベート
        </span>
      )}

      <button
        id="history-toggle"
        className={`nav-btn ${showHistory ? 'active' : ''}`}
        onClick={onToggleHistory}
        aria-pressed={showHistory}
        aria-label="履歴を開く (Ctrl+H)"
      >
        <span aria-hidden="true">🕘</span>
      </button>

      <button
        id="menu-toggle"
        className={`nav-btn ${showMenu ? 'active' : ''}`}
        onClick={onToggleMenu}
        aria-expanded={showMenu}
        aria-haspopup="dialog"
        aria-label="メニュー"
      >
        <span aria-hidden="true">☰</span>
      </button>

      <select
        id="engine-select"
        value={engine}
        onChange={(e) => onEngineChange(e.target.value as EngineId)}
        aria-label="検索エンジンを選択"
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
