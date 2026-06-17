// アプリ情報の一元管理（バージョン等はビルド時にnext.config.tsから注入）
// ⚠️ アプリ名・問い合わせ先・著作権表記は実態に合わせて変更すること。
//    商標保護のため「LINE」等の他社名は使用しないこと。

export const APP_INFO = {
  name: 'トークアプリ',                                    // アプリ表示名（要変更）
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.1', // package.json のバージョン
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'dev',   // gitコミット短縮ハッシュ
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? '',     // ビルド日時(ISO)
  copyrightYear: 2026,                                     // 著作権表記の年
  contactEmail: 'support@mail.mail',               // お問い合わせ先（要確認）
} as const;

// 表示用ヘルパー
export const appVersionLabel = `v${APP_INFO.version}`;                 // 例: v0.1.0
export const appCopyright = `© ${APP_INFO.copyrightYear} ${APP_INFO.name}`;

// ビルド日時を YYYY-MM-DD HH:mm 形式に（不正値は空文字）
export function formatBuildDate(): string {
  if (!APP_INFO.buildDate) return '';
  const d = new Date(APP_INFO.buildDate);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
