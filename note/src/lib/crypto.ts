// ノート本文のローカル暗号化（AES-256-GCM）。鍵はパスコードから PBKDF2 で導出する。
// 保存ファイル（IndexedDB / notes.json）のみ暗号化し、同期前に復号するためクラウドは平文。

const PBKDF2_ITERATIONS = 200_000
const PREFIX = 'enc:1:' // 暗号文の識別子（無い場合は平文として扱う）
const PASSCODE_KEY = 'simplenote-passcode'

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

// パスコードから AES-GCM 鍵を導出する
export async function deriveAesKey(pin: string, salt: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ---- 鍵保管庫（モジュールシングルトン）----

let key: CryptoKey | null = null
let enabled = false
let configured = false
let waiters: (() => void)[] = []

// 初回アクセス時に localStorage から「暗号化が有効か」を判定（タイミング競合を防ぐ）
function ensureConfigured() {
  if (configured || typeof window === 'undefined') return
  configured = true
  try {
    const raw = localStorage.getItem(PASSCODE_KEY)
    if (raw) enabled = !!JSON.parse(raw).enabled
  } catch { /* 失敗時は無効扱い */ }
}

function resolveWaiters() {
  waiters.forEach((w) => w())
  waiters = []
}

export const vault = {
  isEnabled(): boolean { ensureConfigured(); return enabled },
  hasKey(): boolean { return key !== null },

  // 暗号化有効かつ鍵未生成（ロック中）の間は待機する
  ready(): Promise<void> {
    ensureConfigured()
    if (!enabled || key) return Promise.resolve()
    return new Promise((res) => waiters.push(res))
  },

  setKey(k: CryptoKey) { key = k; enabled = true; configured = true; resolveWaiters() },
  disable() { key = null; enabled = false; configured = true; resolveWaiters() },

  async encrypt(text: string): Promise<string> {
    ensureConfigured()
    if (!enabled || !key) return text
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
    return `${PREFIX}${toB64(iv)}:${toB64(new Uint8Array(ct))}`
  },

  async decrypt(text: string): Promise<string> {
    if (!text.startsWith(PREFIX)) return text // 平文はそのまま
    if (!key) throw new Error('vault is locked')
    const [, , ivB64, ctB64] = text.split(':')
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      key,
      fromB64(ctB64)
    )
    return dec.decode(pt)
  },
}
