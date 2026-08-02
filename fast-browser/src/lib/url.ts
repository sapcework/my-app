// URL の解釈・表示に関する純粋関数。副作用を持たせないことでテスト可能にしている。

export const HOME = 'https://www.google.com';

export const ENGINES = [
  { id: 'google', name: 'Google', searchUrl: 'https://www.google.com/search?q=' },
  { id: 'ddg', name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q=' },
  { id: 'bing', name: 'Bing', searchUrl: 'https://www.bing.com/search?q=' },
] as const;

export type EngineId = (typeof ENGINES)[number]['id'];

/** アドレスバーへの入力を、実際に遷移する URL へ解決する。 */
export function normalizeUrl(raw: string, engineId: EngineId): string {
  const s = raw.trim();
  if (!s) return HOME;
  if (/^(https?|file):\/\//i.test(s)) return s;

  // ドットを含まない、または空白を含む入力は URL ではなく検索語とみなす
  const looksLikeHost = s.includes('.') && !s.includes(' ');
  if (!looksLikeHost) {
    const engine = ENGINES.find((e) => e.id === engineId) ?? ENGINES[0];
    return engine.searchUrl + encodeURIComponent(s);
  }
  return `https://${s}`;
}

/** タブや履歴の見出しに使う短い表記（www. を落としたホスト名）。 */
export function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * アドレスバー表示用に URL を3分割する。
 * ホスト名を強調し、それ以外を淡く出すことで、
 * 紛らわしいドメイン（フィッシング）を見分けやすくする。
 */
export function splitUrlForDisplay(url: string): { prefix: string; host: string; rest: string } {
  try {
    const u = new URL(url);
    const prefix = `${u.protocol}//${u.username ? `${u.username}@` : ''}`;
    return { prefix, host: u.host, rest: `${u.pathname}${u.search}${u.hash}` };
  } catch {
    // URL として解釈できない入力（検索語の途中など）はそのまま出す
    return { prefix: '', host: url, rest: '' };
  }
}

/** 通信が保護されているか。http:// や解釈不能な入力は「保護されていない」扱い。 */
export function isSecure(url: string): boolean {
  return /^(https|file):\/\//i.test(url);
}

/** 履歴の時刻表示（当日は時刻のみ、それ以外は日付も添える）。 */
export function formatTime(epochSec: number, now: Date = new Date()): string {
  const d = new Date(epochSec * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `${hh}:${mi}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${hh}:${mi}`;
}

/** 履歴を「今日 / 昨日 / それ以前」の見出しにまとめるためのキー。 */
export function dayLabel(epochSec: number, now: Date = new Date()): string {
  const d = new Date(epochSec * 1000);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays} 日前`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 同じページを指す URL かを判定する。
 *
 * `https://a.test` と `https://a.test/` は同一ページだが単純な文字列比較では
 * 別物になる。この差でブックマークの ★ 表示が実態とずれるため、
 * 末尾スラッシュとホスト名の大小を吸収して比較する。
 */
export function sameUrl(a: string, b: string): boolean {
  const canon = (u: string) => {
    try {
      const p = new URL(u);
      const path = p.pathname === '/' ? '' : p.pathname.replace(/\/$/, '');
      return `${p.protocol}//${p.host.toLowerCase()}${path}${p.search}${p.hash}`;
    } catch {
      return u.trim().replace(/\/$/, '');
    }
  };
  return canon(a) === canon(b);
}

/** 履歴検索。タイトルと URL の両方を対象に、大文字小文字を無視して絞り込む。 */
export function matchesQuery(entry: { title: string; url: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return entry.title.toLowerCase().includes(q) || entry.url.toLowerCase().includes(q);
}
