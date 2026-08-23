// 許可／拒否リストに入れるドメインの選び方を、入力中に助ける。
//
// **保護者はここを必ず間違える。** 「下の階層にも適用する」は配下に及ぶだけで
// 兄弟には及ばないので、`www.yahoo.co.jp` を許可しても `quriosity.yahoo.co.jp`
// には届かない（照合はラベル境界で行う。docs/POLICY_MODEL.md §4 段目）。
// しかもエラーは出ず、「許可したのに見られない」という形でだけ表面化する。
//
// 判定そのものはここでは一切しない。eTLD+1 の算出は Rust 側（`inspect_domain`）で、
// 公開サフィックス表を持っているのはそちらだけ。ここは受け取った結果を
// 日本語の文にするだけの純粋な変換なので、そのままテストできる。

import type { DomainCheck } from './types';

export type HintKind = 'error' | 'suggest' | 'info';

export interface DomainHint {
  kind: HintKind;
  label: string; // 見出し。**色を見なくても種類が分かるようにここで言い切る**
  text: string;
  suggestion: string | null; // 代わりに登録するとよいドメイン（eTLD+1）
  canAdd: boolean; // false のときは追加させない。押しても Rust 側で失敗する入力
}

export interface HintInput {
  input: string; // 入力欄の中身（前後の空白は呼び出し側で落とす）
  check: DomainCheck | null; // `inspect_domain` の結果。まだ来ていなければ null
  error: string | null; // 解釈できなかったときの説明
  action: 'allow' | 'block';
  includeSubdomains: boolean;
}

export function domainHint({
  input,
  check,
  error,
  action,
  includeSubdomains,
}: HintInput): DomainHint | null {
  if (!input) return null; // 何も入れていない間は黙っている
  if (error) {
    return { kind: 'error', label: '登録できません', text: error, suggestion: null, canAdd: false };
  }
  if (!check) return null; // 問い合わせ中。前の入力の説明を出すと嘘になる

  const verb = action === 'allow' ? '許可' : '拒否';
  const { normalized, registrable, registrableDomain } = check;

  // 公開サフィックス（`co.jp` など）そのもの。Rust 側も同じ理由で断る
  if (!registrable || !registrableDomain) {
    return {
      kind: 'error',
      label: '登録できません',
      text:
        `${normalized} は個別のサイトではなく、ドメインの共通部分（公開サフィックス）です。` +
        `ここを${verb}すると、その下のサイトが全部まとめて対象になってしまうため登録できません。`,
      suggestion: null,
      canAdd: false,
    };
  }

  const note = normalized === input ? '' : `「${input}」は ${normalized} として登録されます。`;

  // eTLD+1 そのもの。これが保護者に選んでほしい形
  if (normalized === registrableDomain) {
    const text = includeSubdomains
      ? `${normalized} と、その下のすべての名前が対象になります。`
      : `${normalized} ちょうどこの名前だけが対象になります。` +
        `www. などで始まる名前は対象になりません。`;
    return {
      kind: 'info',
      label: '登録される範囲',
      text: note + text,
      suggestion: null,
      canAdd: true,
    };
  }

  // eTLD+1 より下。ここが「許可したのに見られない」の入口
  const prefix = normalized.slice(0, normalized.length - registrableDomain.length); // 例: `www.`
  const missed = action === 'allow' ? `${verb}が届きません` : `${verb}されずにそのまま通ります`;
  const scope = includeSubdomains
    ? `${normalized} と、その下の名前だけが対象になります。` +
      `同じ ${registrableDomain} でも ${prefix} 以外で始まる名前には${missed}。`
    : `${normalized} ちょうどこの名前だけが対象になります。` +
      `同じ ${registrableDomain} の別の名前には${missed}。`;

  return {
    kind: 'suggest',
    label: action === 'allow' ? '届かない名前があります' : '通ってしまう名前があります',
    text: `${note}${scope}サイト全体を${verb}するなら ${registrableDomain} を登録してください。`,
    suggestion: registrableDomain,
    canAdd: true, // 名前を狙って選んだ保護者もいる。止めはせず、知らせるだけ
  };
}
