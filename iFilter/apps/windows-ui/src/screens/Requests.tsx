import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Badge, Empty, Loading, Message, Panel } from '../components';
import { useAsync } from '../hooks';
import { formatTimestamp } from '../labels';
import type { BlockedDomain } from '../types';

export function Requests() {
  const groups = useAsync(() => api.getBlockedGroups(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function allow(domains: string[]) {
    setBusy(true);
    try {
      for (const domain of domains) {
        await api.addOverride({
          domain,
          action: 'allow',
          includeSubdomains: true,
          reason: '遮断された記録から許可',
          expiresAt: null,
        });
      }
      setError(null);
      groups.reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>遮断された記録</h1>

      <Panel
        title="まとめて許可できます"
        description="1 つのページは、本体のほかに画像や文字の配信元など多くのサイトを使います。近い時刻に遮断されたものをまとめて表示していますが、同じページのものかどうかは確実には分かりません。"
      >
        {error && <Message kind="error" text={error} />}
        {groups.loading && <Loading />}
        {groups.error && <Message kind="error" text={groups.error} />}

        {groups.data &&
          (groups.data.length === 0 ? (
            <Empty text="遮断された記録はありません。" />
          ) : (
            groups.data.map((group, index) => (
              <GroupCard
                key={`${group.startedAt}-${index}`}
                startedAt={group.startedAt}
                domains={group.domains}
                busy={busy}
                onAllow={allow}
              />
            ))
          ))}
      </Panel>
    </>
  );
}

function GroupCard({ startedAt, domains, busy, onAllow }: {
  startedAt: string;
  domains: BlockedDomain[];
  busy: boolean;
  onAllow: (domains: string[]) => void;
}) {
  const pending = domains.filter((d) => !d.alreadyAllowed); // 済みのものは選ばせない
  const [selected, setSelected] = useState<string[]>(() => pending.map((d) => d.domain));

  function toggle(domain: string) {
    setSelected((current) =>
      current.includes(domain) ? current.filter((d) => d !== domain) : [...current, domain],
    );
  }

  return (
    <div className="group">
      <div className="group-head">
        <span className="group-time">{formatTimestamp(startedAt)}</span>
        <button
          type="button"
          onClick={() => onAllow(selected)}
          disabled={busy || selected.length === 0}
        >
          選んだ {selected.length} 件を許可
        </button>
      </div>

      <table className="table">
        <tbody>
          {domains.map((row, index) => (
            <tr key={`${row.domain}-${index}`}>
              <td className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(row.domain)}
                  disabled={row.alreadyAllowed}
                  onChange={() => toggle(row.domain)}
                />
              </td>
              <td className="mono">{row.domain}</td>
              <td>
                <Badge decision={row.decision} />
              </td>
              <td className="mono dim">{row.ruleId}</td>
              <td className="dim">{row.alreadyAllowed ? '許可済み' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
