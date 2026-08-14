import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Empty, Loading, Message, Panel } from '../components';
import { useAsync } from '../hooks';
import { formatTimestamp } from '../labels';

export function Overrides({ action }: { action: 'allow' | 'block' }) {
  const overrides = useAsync(() => api.getOverrides(), []);
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = action === 'allow' ? '許可リスト' : '拒否リスト';
  const rows = overrides.data?.filter((row) => row.action === action) ?? [];

  async function add() {
    const value = domain.trim();
    if (!value) return;

    setBusy(true);
    try {
      await api.addOverride({
        domain: value,
        action,
        includeSubdomains,
        reason,
        expiresAt: null,
      });
      setDomain('');
      setReason('');
      setError(null);
      overrides.reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.removeOverride(id);
      setError(null);
      overrides.reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{title}</h1>

      <Panel
        title="サイトを追加"
        description={
          action === 'allow'
            ? '種類の設定より優先して見られるようにします。'
            : '種類の設定にかかわらず遮断します。許可より優先されます。'
        }
      >
        {error && <Message kind="error" text={error} />}

        <div className="row">
          <input
            type="text"
            value={domain}
            placeholder="example.com"
            onChange={(e) => setDomain(e.target.value)}
          />
          <input
            type="text"
            value={reason}
            placeholder="理由（任意・例: 学校の宿題）"
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="button" onClick={() => void add()} disabled={busy || !domain.trim()}>
            追加
          </button>
        </div>

        <label className="inline">
          <input
            type="checkbox"
            checked={includeSubdomains}
            onChange={(e) => setIncludeSubdomains(e.target.checked)}
          />
          下の階層（www. などを含む）にも適用する
        </label>
      </Panel>

      <Panel title="登録済み">
        {overrides.loading && <Loading />}
        {overrides.error && <Message kind="error" text={overrides.error} />}

        {overrides.data &&
          (rows.length === 0 ? (
            <Empty text="まだ登録がありません。" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>サイト</th>
                  <th>範囲</th>
                  <th>理由</th>
                  <th>期限</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.domain}</td>
                    <td>{row.includeSubdomains ? '下の階層も' : 'このサイトのみ'}</td>
                    <td>{row.reason || '—'}</td>
                    <td>{row.expiresAt ? formatTimestamp(row.expiresAt) : '常に'}</td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        disabled={busy}
                        onClick={() => void remove(row.id)}
                      >
                        取り消す
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Panel>
    </>
  );
}
