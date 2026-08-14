import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Empty, Loading, Message, Panel, VerdictView } from '../components';
import type { AsyncState } from '../hooks';
import { useAsync } from '../hooks';
import { formatTimestamp } from '../labels';
import type { FilterStatus, Verdict } from '../types';

export function Dashboard({ status }: { status: AsyncState<FilterStatus> }) {
  const summary = useAsync(() => api.getDailySummary(), []);

  return (
    <>
      <h1>ホーム</h1>

      <Panel title="フィルターの状態">
        {status.loading && <Loading />}
        {status.data && (
          <dl className="facts">
            <dt>動作</dt>
            <dd>
              {status.data.installed
                ? status.data.running
                  ? '動作中'
                  : '停止中'
                : 'まだ設置されていません'}
            </dd>
            <dt>設定の保存先</dt>
            <dd className="mono">{status.data.databasePath}</dd>
          </dl>
        )}
      </Panel>

      <Panel title="この 24 時間">
        {summary.loading && <Loading />}
        {summary.error && <Message kind="error" text={summary.error} />}
        {summary.data && (
          <>
            <div className="tiles">
              <Tile label="許可" value={summary.data.allowed} />
              <Tile label="遮断" value={summary.data.blocked} />
              <Tile label="要確認" value={summary.data.review} />
            </div>

            {summary.data.topBlocked.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>よく遮断されたサイト</th>
                    <th className="num">回数</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.topBlocked.map((row) => (
                    <tr key={row.domain}>
                      <td className="mono">{row.domain}</td>
                      <td className="num">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text="遮断された記録はありません。" />
            )}
          </>
        )}
      </Panel>

      <DomainTester />
      <RecentDecisions />
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

// 保護者が「このサイトは見られる？」を確かめる。
//
// **この判定は履歴に残さない。** 保護者が確認のために試した操作を、
// 子供の閲覧記録に混ぜない。
function DomainTester() {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<{ domain: string; verdict: Verdict } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    const domain = input.trim();
    if (!domain) return;

    setBusy(true);
    try {
      const verdict = await api.checkDomain(domain);
      setChecked({ domain, verdict });
      setError(null);
    } catch (err: unknown) {
      setError(errorMessage(err));
      setChecked(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="このサイトは見られる？"
      description="実際に見られるかどうかと、その理由を確かめます。ここで試した内容は記録に残りません。"
    >
      <div className="row">
        <input
          type="text"
          value={input}
          placeholder="example.com"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void check();
          }}
        />
        <button type="button" onClick={() => void check()} disabled={busy || !input.trim()}>
          調べる
        </button>
      </div>

      {error && <Message kind="error" text={error} />}
      {checked && <VerdictView domain={checked.domain} verdict={checked.verdict} />}
    </Panel>
  );
}

function RecentDecisions() {
  const recent = useAsync(() => api.getRecentDecisions(20), []);

  return (
    <Panel title="最近の記録">
      {recent.loading && <Loading />}
      {recent.error && <Message kind="error" text={recent.error} />}
      {recent.data &&
        (recent.data.length === 0 ? (
          <Empty text="まだ記録がありません。フィルターが動き始めると表示されます。" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>時刻</th>
                <th>サイト</th>
                <th>結果</th>
                <th>ルール</th>
              </tr>
            </thead>
            <tbody>
              {recent.data.map((row, index) => (
                <tr key={`${row.timestamp}-${row.domain}-${index}`}>
                  <td>{formatTimestamp(row.timestamp)}</td>
                  <td className="mono">{row.domain}</td>
                  <td>
                    <span className={`badge badge-${row.decision}`}>
                      {row.decision === 'allow' ? '許可' : row.decision === 'block' ? '遮断' : '要確認'}
                    </span>
                  </td>
                  <td className="mono dim">{row.ruleId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </Panel>
  );
}
