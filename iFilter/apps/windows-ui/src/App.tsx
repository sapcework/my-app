import { useState } from 'react';
import { api } from './api';
import { Message } from './components';
import { useAsync } from './hooks';
import { labelFor, profileLabel } from './labels';
import { Categories } from './screens/Categories';
import { Dashboard } from './screens/Dashboard';
import { Overrides } from './screens/Overrides';
import { ProfileScreen } from './screens/ProfileScreen';
import { Requests } from './screens/Requests';
import { Settings } from './screens/Settings';

type ScreenId = 'dashboard' | 'requests' | 'profile' | 'categories' | 'allowlist' | 'blocklist' | 'settings';

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'dashboard', label: 'ホーム' },
  { id: 'requests', label: '遮断された記録' },
  { id: 'profile', label: 'プロファイル' },
  { id: 'categories', label: 'サイトの種類' },
  { id: 'allowlist', label: '許可リスト' },
  { id: 'blocklist', label: '拒否リスト' },
  { id: 'settings', label: '設定' },
];

export function App() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');
  const status = useAsync(() => api.getStatus(), []);

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <span className="brand-name">iFilter</span>
          <span className="brand-sub">保護者設定</span>
        </div>

        {SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === screen ? 'nav-item nav-item-active' : 'nav-item'}
            onClick={() => setScreen(item.id)}
          >
            {item.label}
          </button>
        ))}

        <div className="nav-status">
          {status.data && (
            <>
              <span className={status.data.running ? 'dot dot-on' : 'dot dot-off'} />
              {status.data.running ? '動作中' : status.data.installed ? '停止中' : '未設置'}
              <div className="nav-profile">{labelFor(profileLabel, status.data.profile)}</div>
            </>
          )}
        </div>
      </nav>

      <main className="main">
        {status.error && <Message kind="error" text={status.error} />}

        {screen === 'dashboard' && <Dashboard status={status} />}
        {screen === 'requests' && <Requests />}
        {screen === 'profile' && <ProfileScreen onChanged={status.reload} />}
        {screen === 'categories' && <Categories />}
        {screen === 'allowlist' && <Overrides action="allow" />}
        {screen === 'blocklist' && <Overrides action="block" />}
        {screen === 'settings' && <Settings status={status} />}
      </main>
    </div>
  );
}
