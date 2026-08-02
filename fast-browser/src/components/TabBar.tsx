import type { Tab } from '../types';

interface Props {
  tabs: Tab[];
  activeId: number;
  onSwitch: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}

export function TabBar({ tabs, activeId, onSwitch, onClose, onNew }: Props) {
  return (
    <div id="tab-bar" role="tablist" aria-label="開いているタブ">
      {tabs.map((tab) => {
        const label = tab.title || '新しいタブ';
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={tab.id === activeId ? 0 : -1}
            aria-selected={tab.id === activeId}
            className={`tab${tab.id === activeId ? ' active' : ''}`}
            onClick={() => onSwitch(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSwitch(tab.id);
              }
            }}
            title={`${label}\n${tab.url}`}
          >
            <span className="tab-icon" aria-hidden="true">
              {tab.is_loading ? (
                <span className="tab-spinner" />
              ) : (
                tab.favicon && (
                  <img
                    className="tab-favicon"
                    src={tab.favicon}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                )
              )}
            </span>
            <span className="tab-title">{label}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                aria-label={`${label} を閉じる`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        );
      })}
      <button className="new-tab-btn" onClick={onNew} aria-label="新しいタブを開く (Ctrl+T)">
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
