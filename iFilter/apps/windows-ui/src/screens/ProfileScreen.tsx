import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Loading, Message, Panel } from '../components';
import { useAsync } from '../hooks';
import { decisionLabel, labelFor, profileLabel, riskLabel } from '../labels';
import type { Profile } from '../types';

// プロファイルの ID は文字列か { custom: uuid }。同梱の 4 つだけを扱う
function profileId(profile: Profile): string {
  return typeof profile.id === 'string' ? profile.id : 'custom';
}

export function ProfileScreen({ onChanged }: { onChanged: () => void }) {
  const profiles = useAsync(() => api.getProfiles(), []);
  const active = useAsync(() => api.getActiveProfile(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function select(id: string) {
    setBusy(true);
    try {
      await api.setActiveProfile(id);
      setError(null);
      active.reload();
      onChanged();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const activeId = active.data ? profileId(active.data) : null;

  return (
    <>
      <h1>プロファイル</h1>

      <Panel
        title="使用中のプロファイル"
        description="年齢ではなく「インターネットの慣れ」を目安に選びます。変更は数秒でフィルターに反映されます。"
      >
        {error && <Message kind="error" text={error} />}
        {(profiles.loading || active.loading) && <Loading />}
        {profiles.error && <Message kind="error" text={profiles.error} />}

        {profiles.data
          ?.filter((p) => typeof p.id === 'string')
          .map((profile) => {
            const id = profileId(profile);
            return (
              <label key={id} className={id === activeId ? 'choice choice-active' : 'choice'}>
                <input
                  type="radio"
                  name="profile"
                  checked={id === activeId}
                  disabled={busy}
                  onChange={() => void select(id)}
                />
                <div>
                  <div className="choice-title">{labelFor(profileLabel, id)}</div>
                  <div className="choice-detail">
                    未分類のサイト: {decisionLabel[profile.unknown_policy]} ／ 許容する危険度:{' '}
                    {labelFor(riskLabel, profile.risk_ceiling)}
                    {profile.review_as_block && ' ／ 要確認は遮断として扱う'}
                  </div>
                </div>
              </label>
            );
          })}
      </Panel>

      {active.data && (
        <Panel
          title="このプロファイルの扱い"
          description="細かい調整は「サイトの種類」の画面で行います。"
        >
          <dl className="facts">
            <dt>未分類のサイト</dt>
            <dd>{decisionLabel[active.data.unknown_policy]}</dd>
            <dt>許容する危険度</dt>
            <dd>{labelFor(riskLabel, active.data.risk_ceiling)} まで</dd>
            <dt>要確認の扱い</dt>
            <dd>{active.data.review_as_block ? '遮断する' : '記録に残して保護者が判断'}</dd>
            <dt>どれにも当てはまらない場合</dt>
            <dd>{decisionLabel[active.data.default_decision]}</dd>
          </dl>
        </Panel>
      )}
    </>
  );
}
