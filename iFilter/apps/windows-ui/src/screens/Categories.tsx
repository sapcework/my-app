import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Loading, Message, Panel } from '../components';
import { useAsync } from '../hooks';
import { decisionLabel, labelFor, profileLabel, riskLabel } from '../labels';
import type { DecisionName } from '../types';

const CHOICES: DecisionName[] = ['allow', 'review', 'block'];

export function Categories() {
  const active = useAsync(() => api.getActiveProfile(), []);
  const [target, setTarget] = useState<string | null>(null);
  const profile = target ?? (typeof active.data?.id === 'string' ? active.data.id : null);

  const rules = useAsync(
    () => (profile ? api.getCategoryRules(profile) : Promise.resolve([])),
    [profile],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(category: string, decision: DecisionName) {
    if (!profile) return;
    setBusy(category);
    try {
      await api.setCategoryRule(profile, category, decision);
      setError(null);
      rules.reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>サイトの種類</h1>

      <Panel
        title="種類ごとの扱い"
        description="ここで決めた扱いは、そのプロファイルを使っているあいだ適用されます。個別のサイトは許可リスト・拒否リストが優先されます。"
      >
        <div className="row">
          <label htmlFor="profile-select">対象のプロファイル</label>
          <select
            id="profile-select"
            value={profile ?? ''}
            onChange={(e) => setTarget(e.target.value)}
          >
            {['beginner', 'beginner_plus', 'standard', 'teen'].map((id) => (
              <option key={id} value={id}>
                {labelFor(profileLabel, id)}
              </option>
            ))}
          </select>
        </div>

        {error && <Message kind="error" text={error} />}
        {rules.loading && <Loading />}
        {rules.error && <Message kind="error" text={rules.error} />}

        {rules.data && (
          <table className="table">
            <thead>
              <tr>
                <th>種類</th>
                <th>目安の危険度</th>
                <th>扱い</th>
              </tr>
            </thead>
            <tbody>
              {rules.data.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    {rule.displayName}
                    <span className="mono dim"> {rule.id}</span>
                  </td>
                  <td>{labelFor(riskLabel, rule.defaultRisk)}</td>
                  <td>
                    <div className="segmented">
                      {CHOICES.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          className={rule.decision === choice ? 'seg seg-active' : 'seg'}
                          disabled={busy === rule.id}
                          onClick={() => void change(rule.id, choice)}
                        >
                          {decisionLabel[choice]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
