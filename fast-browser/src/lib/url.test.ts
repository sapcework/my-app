import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  shortUrl,
  splitUrlForDisplay,
  isSecure,
  formatTime,
  dayLabel,
  matchesQuery,
  sameUrl,
  HOME,
} from './url';

describe('normalizeUrl', () => {
  it('スキーム付きの入力はそのまま通す', () => {
    expect(normalizeUrl('https://a.test/x', 'google')).toBe('https://a.test/x');
    expect(normalizeUrl('http://a.test', 'google')).toBe('http://a.test');
    expect(normalizeUrl('file:///c:/x.html', 'google')).toBe('file:///c:/x.html');
  });

  it('ホスト名らしい入力には https を補う', () => {
    expect(normalizeUrl('example.com', 'google')).toBe('https://example.com');
    expect(normalizeUrl('  example.com/a  ', 'google')).toBe('https://example.com/a');
  });

  it('ドットが無い・空白を含む入力は検索クエリとして扱う', () => {
    expect(normalizeUrl('hello', 'google')).toBe('https://www.google.com/search?q=hello');
    expect(normalizeUrl('rust lang', 'ddg')).toBe('https://duckduckgo.com/?q=rust%20lang');
    expect(normalizeUrl('a.com b', 'bing')).toBe('https://www.bing.com/search?q=a.com%20b');
  });

  it('検索語はエスケープされる（クエリ注入を防ぐ）', () => {
    expect(normalizeUrl('a&b=c', 'google')).toBe('https://www.google.com/search?q=a%26b%3Dc');
  });

  it('空入力はホームに落ちる', () => {
    expect(normalizeUrl('   ', 'google')).toBe(HOME);
  });
});

describe('shortUrl', () => {
  it('www を落としたホスト名を返す', () => {
    expect(shortUrl('https://www.example.com/a?b=1')).toBe('example.com');
  });
  it('解釈できない文字列はそのまま返す', () => {
    expect(shortUrl('not a url')).toBe('not a url');
  });
});

describe('splitUrlForDisplay', () => {
  it('ホスト名を強調表示できるよう3分割する', () => {
    expect(splitUrlForDisplay('https://a.test/p?q=1#h')).toEqual({
      prefix: 'https://',
      host: 'a.test',
      rest: '/p?q=1#h',
    });
  });

  it('紛らわしいユーザー情報付き URL でも実ホストを分離する', () => {
    // https://google.com@evil.test/ の実際の接続先は evil.test
    const parts = splitUrlForDisplay('https://google.com@evil.test/');
    expect(parts.host).toBe('evil.test');
  });

  it('URL でない入力は host にそのまま入れる', () => {
    expect(splitUrlForDisplay('検索語')).toEqual({ prefix: '', host: '検索語', rest: '' });
  });
});

describe('isSecure', () => {
  it('https と file を安全とみなす', () => {
    expect(isSecure('https://a.test')).toBe(true);
    expect(isSecure('file:///c:/x')).toBe(true);
  });
  it('http と不明な入力は安全でない', () => {
    expect(isSecure('http://a.test')).toBe(false);
    expect(isSecure('a.test')).toBe(false);
  });
});

describe('formatTime / dayLabel', () => {
  const now = new Date(2026, 7, 3, 12, 0, 0); // 2026-08-03 12:00

  it('当日は時刻のみ表示する', () => {
    const t = new Date(2026, 7, 3, 9, 5, 0).getTime() / 1000;
    expect(formatTime(t, now)).toBe('09:05');
  });

  it('別日は日付も表示する', () => {
    const t = new Date(2026, 7, 1, 9, 5, 0).getTime() / 1000;
    expect(formatTime(t, now)).toBe('08/01 09:05');
  });

  it('今日・昨日・N日前で見出しを分ける', () => {
    const at = (d: number, h = 10) => new Date(2026, 7, d, h).getTime() / 1000;
    expect(dayLabel(at(3), now)).toBe('今日');
    expect(dayLabel(at(2), now)).toBe('昨日');
    expect(dayLabel(at(1), now)).toBe('2 日前');
  });

  it('日付をまたぐ境界で「今日」判定がずれない', () => {
    const justAfterMidnight = new Date(2026, 7, 3, 0, 1).getTime() / 1000;
    expect(dayLabel(justAfterMidnight, now)).toBe('今日');
    const justBeforeMidnight = new Date(2026, 7, 2, 23, 59).getTime() / 1000;
    expect(dayLabel(justBeforeMidnight, now)).toBe('昨日');
  });
});

describe('sameUrl', () => {
  it('末尾スラッシュの有無を同一とみなす', () => {
    expect(sameUrl('https://a.test', 'https://a.test/')).toBe(true);
    expect(sameUrl('https://a.test/p/', 'https://a.test/p')).toBe(true);
  });

  it('ホスト名の大小を無視する', () => {
    expect(sameUrl('https://A.Test/', 'https://a.test/')).toBe(true);
  });

  it('パス・クエリ・スキームが違えば別物とみなす', () => {
    expect(sameUrl('https://a.test/x', 'https://a.test/y')).toBe(false);
    expect(sameUrl('https://a.test/?q=1', 'https://a.test/')).toBe(false);
    expect(sameUrl('http://a.test/', 'https://a.test/')).toBe(false);
  });

  it('URL でない入力でも落ちない', () => {
    expect(sameUrl('検索語', '検索語')).toBe(true);
    expect(sameUrl('検索語', 'ほか')).toBe(false);
  });
});

describe('matchesQuery', () => {
  const e = { title: 'Rust 公式サイト', url: 'https://www.rust-lang.org/' };

  it('タイトル・URL のどちらでも大文字小文字を無視してヒットする', () => {
    expect(matchesQuery(e, 'rust')).toBe(true);
    expect(matchesQuery(e, 'RUST-LANG')).toBe(true);
    expect(matchesQuery(e, '公式')).toBe(true);
  });

  it('一致しない語は除外する', () => {
    expect(matchesQuery(e, 'python')).toBe(false);
  });

  it('空クエリは全件を通す', () => {
    expect(matchesQuery(e, '   ')).toBe(true);
  });
});
