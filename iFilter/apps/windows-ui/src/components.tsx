// 画面をまたいで使う小さな部品。

import type { ReactNode } from 'react';
import { decisionLabel, labelFor, outcomeLabel, reasonLabel, stageLabel } from './labels';
import type { DecisionName, Verdict } from './types';

export function Badge({ decision }: { decision: DecisionName }) {
  return <span className={`badge badge-${decision}`}>{decisionLabel[decision]}</span>;
}

export function Panel({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {description && <p className="panel-note">{description}</p>}
      {children}
    </section>
  );
}

export function Message({ kind, text }: { kind: 'error' | 'info'; text: string }) {
  return <p className={`message message-${kind}`}>{text}</p>;
}

export function Loading() {
  return <p className="loading">読み込んでいます…</p>;
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

// 判定の結果と、9 段の経過をそのまま見せる。
//
// 「なぜブロックされたか」を保護者が理解できることがこの製品の価値そのもの
// （docs/POLICY_MODEL.md §1-6）。要約して情報を落とさない。
export function VerdictView({ domain, verdict }: { domain: string; verdict: Verdict }) {
  return (
    <div className="verdict">
      <div className="verdict-head">
        <Badge decision={verdict.decision} />
        <span className="verdict-domain">{domain}</span>
      </div>

      <dl className="verdict-facts">
        <dt>理由</dt>
        <dd>{labelFor(reasonLabel, verdict.reason)}</dd>
        <dt>ルール</dt>
        <dd className="mono">{verdict.matched_rule}</dd>
        {verdict.matched_domain && (
          <>
            <dt>一致先</dt>
            <dd className="mono">{verdict.matched_domain}</dd>
          </>
        )}
      </dl>

      <details className="trace">
        <summary>判定の経過（{verdict.trace.length} 段）</summary>
        <ol>
          {verdict.trace.map((step, index) => (
            <li key={`${step.stage}-${index}`}>
              <span className="trace-stage">{labelFor(stageLabel, step.stage)}</span>
              <span className="trace-outcome">{labelFor(outcomeLabel, step.outcome.outcome)}</span>
              {step.outcome.decision && <Badge decision={step.outcome.decision} />}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
