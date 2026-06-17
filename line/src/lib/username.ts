// ユーザー名ベース認証（メール不要）のための変換ユーティリティ。
// 管理者が発行する「ユーザー名＋パスワード」を、内部的に擬似メールへ写像する。

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/; // 英小文字・数字・アンダースコア 3〜20文字
const SYNTHETIC_DOMAIN = 'talk.local';          // 実在しない内部ドメイン

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

// ユーザー名 → 擬似メール（例: taro → taro@talk.local）
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_DOMAIN}`;
}

// ログイン入力をメールへ変換：@を含めば既存メールとして扱い、無ければユーザー名とみなす
export function identifierToEmail(input: string): string {
  const v = input.trim();
  return v.includes('@') ? v.toLowerCase() : usernameToEmail(v);
}
