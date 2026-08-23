import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Empty, Loading, Message, Panel } from '../components';
import { domainHint } from '../domainHint';
import { useAsync, useDebounced } from '../hooks';
import { formatTimestamp } from '../labels';
import type { DomainCheck } from '../types';

// 入力中のドメインを Rust 側に見てもらった結果。**どの入力に対する答えかを持つ。**
// 持たないと、打ち直した直後に前の入力の説明が残り、正規化の案内が嘘になる。
interface Inspected {
  input: string;
  check: DomainCheck | null;
  error: string | null;
}

export function Overrides({ action }: { action: 'allow' | 'block' }) {
  const overrides = useAsync(() => api.getOverrides(), []);
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspected, setInspected] = useState<Inspected | null>(null);

  const title = action === 'allow' ? '許可リスト' : '拒否リスト';
  const rows = overrides.data?.filter((row) => row.action === action) ?? [];

  // eTLD+1 の算出は Rust 側にしかない（公開サフィックス表を持っているのがそちらだけ）。
  // 判定と同じ規則で答えてもらうことが大事で、UI 側で近い処理を書いてはいけない
  const typed = useDebounced(domain.trim());
  useEffect(() => {
    if (!typed) return; // 空欄のときは消さなくてよい。入力と一致しない答えは下で捨てる
    let cancelled = false; // 打ち直しの途中で古い答えを書き込まない

    api
      .inspectDomain(typed)
      .then((check) => {
        if (!cancelled) setInspected({ input: typed, check, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setInspected({ input: typed, check: null, error: errorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [typed]);

  const fresh = inspected?.input === typed ? inspected : null; // 答え待ちの間は何も出さない
  const hint = domainHint({
    input: typed,
    check: fresh?.check ?? null,
    error: fresh?.error ?? null,
    action,
    includeSubdomains,
  });

  // 提案を受け入れたら「下の階層も」も入れる。eTLD+1 を単体で登録しても
  // www. すら対象にならず、提案の意味（サイト全体）が果たせない
  function applySuggestion(suggestion: string) {
    setDomain(suggestion);
    setIncludeSubdomains(true);
  }

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
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !domain.trim() || hint?.canAdd === false}
          >
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

        {hint && (
          <div className={`hint hint-${hint.kind}`}>
            <p className="hint-label">{hint.label}</p>
            <p>{hint.text}</p>
            {hint.suggestion && (
              <button
                type="button"
                className="link"
                onClick={() => applySuggestion(hint.suggestion as string)}
              >
                {hint.suggestion} にする
              </button>
            )}
          </div>
        )}
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
