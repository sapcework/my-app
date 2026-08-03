import { describe, it, expect } from 'vitest';
import { MESSAGES, LOCALES, translate, type MessageKey } from './messages';

describe('辞書の網羅性', () => {
  it('すべての言語が同じキー集合を持つ', () => {
    const jaKeys = Object.keys(MESSAGES.ja).sort();
    for (const { id } of LOCALES) {
      expect(Object.keys(MESSAGES[id]).sort(), `${id} のキーが ja と一致しない`).toEqual(jaKeys);
    }
  });

  it('空文字のメッセージが無い', () => {
    for (const { id } of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[id])) {
        expect(value.trim(), `${id}/${key} が空`).not.toBe('');
      }
    }
  });

  it('プレースホルダの集合が言語間で一致する', () => {
    const holders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(MESSAGES.ja) as MessageKey[]) {
      const expected = holders(MESSAGES.ja[key]);
      for (const { id } of LOCALES) {
        expect(holders(MESSAGES[id][key]), `${id}/${key} のプレースホルダが不一致`).toEqual(
          expected,
        );
      }
    }
  });
});

describe('translate', () => {
  it('プレースホルダを差し替える', () => {
    expect(translate('ja', 'history.count', { n: 3 })).toBe('3 件');
    expect(translate('en', 'history.count', { n: 3 })).toBe('3 items');
    expect(translate('ja', 'history.countFiltered', { shown: 2, total: 9 })).toBe('2 / 9 件');
  });

  it('値が渡されなかったプレースホルダはそのまま残す（誤って消さない）', () => {
    expect(translate('ja', 'bm.added', {})).toBe('「{name}」をブックマークに追加しました');
  });

  it('複数箇所に同じ変数が出ても差し替わる', () => {
    expect(translate('en', 'find.position', { index: 1, total: 5 })).toBe('1 of 5');
  });

  it('未知の言語は日本語にフォールバックする', () => {
    // 実行時に壊れた設定が入っていても画面が空にならないこと
    const bogus = 'xx' as never;
    expect(translate(bogus, 'menu.history')).toBe('履歴');
  });
});
