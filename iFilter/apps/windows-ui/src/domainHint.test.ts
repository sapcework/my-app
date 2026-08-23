// 入力の助言が、実際の照合規則と食い違っていないことを見る。
//
// 食い違っても画面は落ちない。保護者が助言どおりに登録して、
// **それでも見られない**という形でだけ出る。いちばん気づきにくい壊れ方なので、
// 文言の中身まで押さえておく。

import { describe, expect, it } from 'vitest';
import { domainHint } from './domainHint';
import type { DomainCheck } from './types';

function check(normalized: string, registrableDomain: string | null): DomainCheck {
  return { normalized, registrable: registrableDomain !== null, registrableDomain };
}

const base = { error: null, action: 'allow' as const, includeSubdomains: true };

describe('ドメイン入力の助言', () => {
  it('入力前と問い合わせ中は何も出さない', () => {
    expect(domainHint({ ...base, input: '', check: null })).toBeNull();
    expect(domainHint({ ...base, input: 'yahoo.co.jp', check: null })).toBeNull();
  });

  it('解釈できない入力はそのまま理由を出し、追加させない', () => {
    const hint = domainHint({ ...base, input: 'ht tp://', check: null, error: '解釈できません' });
    expect(hint).toMatchObject({ kind: 'error', canAdd: false, text: '解釈できません' });
    expect(hint?.label).toBe('登録できません');
  });

  it('公開サフィックスは追加させない', () => {
    const hint = domainHint({ ...base, input: 'co.jp', check: check('co.jp', null) });
    expect(hint?.kind).toBe('error');
    expect(hint?.canAdd).toBe(false);
    expect(hint?.label).toBe('登録できません');
  });

  it('eTLD+1 より下なら eTLD+1 を提案する', () => {
    const hint = domainHint({
      ...base,
      input: 'www.yahoo.co.jp',
      check: check('www.yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.kind).toBe('suggest');
    expect(hint?.label).toBe('届かない名前があります');
    expect(hint?.suggestion).toBe('yahoo.co.jp');
    expect(hint?.text).toContain('www. 以外で始まる名前には許可が届きません');
    expect(hint?.canAdd).toBe(true); // 狙って選んだ保護者を止めはしない
  });

  it('提案は eTLD+1 そのものには出さない', () => {
    const hint = domainHint({
      ...base,
      input: 'yahoo.co.jp',
      check: check('yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.kind).toBe('info');
    expect(hint?.suggestion).toBeNull();
    expect(hint?.text).toContain('その下のすべての名前が対象');
  });

  it('下の階層を含めないときは、その 1 件だけが対象だと伝える', () => {
    const hint = domainHint({
      ...base,
      includeSubdomains: false,
      input: 'yahoo.co.jp',
      check: check('yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.text).toContain('ちょうどこの名前だけ');
  });

  it('拒否リストでは「通ってしまう」側の危険を伝える', () => {
    const hint = domainHint({
      ...base,
      action: 'block',
      input: 'www.example.com',
      check: check('www.example.com', 'example.com'),
    });
    expect(hint?.label).toBe('通ってしまう名前があります');
    expect(hint?.text).toContain('拒否されずにそのまま通ります');
    expect(hint?.text).toContain('サイト全体を拒否するなら example.com');
  });

  it('正規化で入力と変わるときは、そのことを先に伝える', () => {
    const hint = domainHint({
      ...base,
      input: 'YAHOO.co.jp.',
      check: check('yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.text).toContain('「YAHOO.co.jp.」は yahoo.co.jp として登録されます');
  });

  it('多段のサブドメインでも、残りの部分をそのまま示す', () => {
    const hint = domainHint({
      ...base,
      input: 'a.b.example.com',
      check: check('a.b.example.com', 'example.com'),
    });
    expect(hint?.text).toContain('a.b. 以外で始まる名前');
  });
});

// ARCHITECTURE 7-9。**遮断漏れではなく、DNS の粒度そのものの限界。**
// 2026-08-23 の実機確認で、yahoo.co.jp を許可したらトップページの見出しに
// 小学生へ見せたくないものが並んだ。外部の広告配信元は BLOCK のままだった。
describe('サイト全体を許可することの注意', () => {
  it('eTLD+1 を配下ごと許可するときに添える', () => {
    const hint = domainHint({
      ...base,
      input: 'yahoo.co.jp',
      check: check('yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.kind).toBe('info');
    expect(hint?.caution).toContain('ページ単位では選べません');
    expect(hint?.caution).toContain('子供向けの入口');
  });

  it('提案の時点で添える。受け入れてからでは遅い', () => {
    // 提案を押すと「下の階層も」が立つので、押した結果はサイト全体の許可になる。
    // いまのチェックの状態ではなく、受け入れた後に何が起きるかで決める
    const hint = domainHint({
      ...base,
      includeSubdomains: false,
      input: 'www.yahoo.co.jp',
      check: check('www.yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.kind).toBe('suggest');
    expect(hint?.suggestion).toBe('yahoo.co.jp');
    expect(hint?.caution).toContain('ページ単位では選べません');
  });

  it('拒否には添えない。広げても保護する方向にしか働かない', () => {
    const 拒否 = { ...base, action: 'block' as const };
    expect(
      domainHint({ ...拒否, input: 'yahoo.co.jp', check: check('yahoo.co.jp', 'yahoo.co.jp') })
        ?.caution,
    ).toBeNull();
    expect(
      domainHint({
        ...拒否,
        input: 'www.yahoo.co.jp',
        check: check('www.yahoo.co.jp', 'yahoo.co.jp'),
      })?.caution,
    ).toBeNull();
  });

  it('この名前だけの許可には添えない。サイト全体にならない', () => {
    const hint = domainHint({
      ...base,
      includeSubdomains: false,
      input: 'yahoo.co.jp',
      check: check('yahoo.co.jp', 'yahoo.co.jp'),
    });
    expect(hint?.kind).toBe('info');
    expect(hint?.caution).toBeNull();
  });

  it('登録できない入力には添えない。そもそも登録されない', () => {
    expect(domainHint({ ...base, input: 'co.jp', check: check('co.jp', null) })?.caution).toBeNull();
    expect(
      domainHint({ ...base, input: 'ht tp://', check: null, error: '解釈できません' })?.caution,
    ).toBeNull();
  });
});
