import { useState } from 'react';
import { api, errorMessage } from '../api';
import { Loading, Message, Panel } from '../components';
import type { AsyncState } from '../hooks';
import type { FilterStatus } from '../types';

export function Settings({ status }: { status: AsyncState<FilterStatus> }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await task();
      setError(null);
      setNotice(message);
      status.reload();
    } catch (err: unknown) {
      setError(errorMessage(err));
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  const dohDisabled = status.data?.browserPolicies.every((p) => p.disabled) ?? false;

  return (
    <>
      <h1>設定</h1>

      {error && <Message kind="error" text={error} />}
      {notice && <Message kind="info" text={notice} />}

      <Panel
        title="フィルター"
        description="止めているあいだ、この PC のサイト制限は働きません。"
      >
        {status.loading && <Loading />}
        {status.data && !status.data.installed && (
          <Message
            kind="info"
            text="フィルターがまだ設置されていません。管理者の PowerShell で ifilter-service install を実行してください。"
          />
        )}
        {status.data?.installed && (
          <div className="row">
            <span>現在: {status.data.running ? '動作中' : '停止中'}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.setFilterEnabled(!status.data!.running),
                  status.data!.running ? 'フィルターを停止しました。' : 'フィルターを開始しました。',
                )
              }
            >
              {status.data.running ? '停止する' : '開始する'}
            </button>
          </div>
        )}
      </Panel>

      <Panel
        title="ブラウザの暗号化 DNS を無効にする"
        description="ブラウザが独自に名前を調べる機能（DNS over HTTPS）を使うと、iFilter を通らずにサイトへ繋がってしまいます。無効にすると確実に iFilter を通ります。変更後はブラウザの再起動が必要です。"
      >
        {status.data && (
          <>
            <ul className="policy-list">
              {status.data.browserPolicies.map((policy) => (
                <li key={policy.browser}>
                  <span className={policy.disabled ? 'dot dot-on' : 'dot dot-off'} />
                  {policy.browser}: {policy.disabled ? '無効化済み' : '未設定'}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.setBrowserDohDisabled(!dohDisabled),
                  dohDisabled ? '設定を取り消しました。' : '暗号化 DNS を無効にしました。',
                )
              }
            >
              {dohDisabled ? '設定を取り消す' : 'まとめて無効にする'}
            </button>
          </>
        )}
      </Panel>

      <Panel title="この PC の設定">
        {status.data && (
          <dl className="facts">
            <dt>設定の保存先</dt>
            <dd className="mono">{status.data.databasePath}</dd>
          </dl>
        )}
        <p className="panel-note">
          この画面は管理者権限で動いています。お子さまのアカウントを標準ユーザーにしておくと、
          保護者のパスワードなしにはこの画面を開けません。
        </p>
      </Panel>
    </>
  );
}
