// パスコード用の PBKDF2 ハッシュユーティリティ（外部依存なし）

// パスコード設定（enabled/hash/salt）の localStorage キー。crypto.ts / PasscodeContext と共有する。
export const PASSCODE_STORAGE_KEY = 'simplenote-passcode'

// 連続失敗回数の記録キー（総当たり対策のロックアウト用）
export const PASSCODE_ATTEMPT_KEY = 'simplenote-passcode-attempts'

// 保存形式のバージョン。v2 から検証ハッシュと暗号鍵の導出をドメイン分離した。
// v1（v フィールド無し）は検証ハッシュ＝暗号鍵と同一ビット列だったため、
// localStorage のハッシュがそのまま AES 鍵として使えてしまう脆弱性があった。
export const PASSCODE_VERSION = 2

export const PBKDF2_ITERATIONS = 200_000 // 総当たりコストを増やすための反復回数（crypto.ts と共有）

// 検証ハッシュ用のドメイン分離サフィックス。暗号鍵（salt そのまま）とは別の出力になる。
const VERIFY_DOMAIN = '|verify'

// パスコード設定を破棄する（ログアウト時などローカルデータを丸ごと消去する操作に合わせて呼ぶ）。
// vault（暗号鍵）側のクリアは呼び出し側の責務。
export function clearPasscode(): void {
  try {
    localStorage.removeItem(PASSCODE_STORAGE_KEY)
    localStorage.removeItem(PASSCODE_ATTEMPT_KEY)
  } catch { /* noop */ }
}

export function generateSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// PBKDF2(SHA-256) で入力をストレッチングして 256bit の hex を返す共通処理
async function pbkdf2Hex(input: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// v2: 検証ハッシュ。salt にドメインを付与し、暗号鍵（deriveAesKey）とは別の出力にする。
export function hashPin(pin: string, salt: string): Promise<string> {
  return pbkdf2Hex(pin, salt + VERIFY_DOMAIN)
}

// v1（旧形式）: 暗号鍵と同一ビット列になる旧ハッシュ。既存データの検証・移行専用。
export function hashPinLegacy(pin: string, salt: string): Promise<string> {
  return pbkdf2Hex(pin, salt)
}

// ---- 試行回数ロックアウト（オンライン総当たり対策）----

const LOCK_THRESHOLD = 5          // この回数連続で失敗するとロック
const LOCK_BASE_MS = 30_000       // 初回ロック 30 秒
const LOCK_MAX_MS = 5 * 60_000    // 最大 5 分

export type AttemptState = { count: number; lockUntil: number }

// 失敗回数からロック時間を計算する（5回目以降、30秒→1分→2分…最大5分）
export function computeLockMs(failCount: number): number {
  if (failCount < LOCK_THRESHOLD) return 0
  return Math.min(LOCK_BASE_MS * Math.pow(2, failCount - LOCK_THRESHOLD), LOCK_MAX_MS)
}

export function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(PASSCODE_ATTEMPT_KEY)
    if (!raw) return { count: 0, lockUntil: 0 }
    const parsed = JSON.parse(raw) as Partial<AttemptState>
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      lockUntil: typeof parsed.lockUntil === 'number' ? parsed.lockUntil : 0,
    }
  } catch {
    return { count: 0, lockUntil: 0 }
  }
}

// 失敗を記録し、更新後の状態を返す
export function registerFailedAttempt(now = Date.now()): AttemptState {
  const prev = readAttempts()
  const count = prev.count + 1
  const lockMs = computeLockMs(count)
  const next: AttemptState = { count, lockUntil: lockMs > 0 ? now + lockMs : 0 }
  try { localStorage.setItem(PASSCODE_ATTEMPT_KEY, JSON.stringify(next)) } catch { /* noop */ }
  return next
}

export function clearAttempts(): void {
  try { localStorage.removeItem(PASSCODE_ATTEMPT_KEY) } catch { /* noop */ }
}

// 残りロック時間（ms）。0 なら入力可能。
export function attemptLockRemaining(now = Date.now()): number {
  const { lockUntil } = readAttempts()
  return Math.max(0, lockUntil - now)
}
