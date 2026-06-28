// パスコード用の PBKDF2 ハッシュユーティリティ（外部依存なし）

export function generateSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const PBKDF2_ITERATIONS = 200_000 // 総当たりコストを増やすための反復回数

// PBKDF2(SHA-256) で PIN をストレッチングしてハッシュ化する。
// SHA-256 単発に比べ検証コストが高く、4桁PINのオフライン総当たりを困難にする。
export async function hashPin(pin: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
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
