// テスト共通セットアップ: Node 環境に localStorage の簡易実装を用意する
// （passcode.ts の試行回数記録などが localStorage に依存するため）

const store = new Map<string, string>()

const localStorageStub: Storage = {
  get length() { return store.size },
  clear: () => store.clear(),
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)) },
  removeItem: (key: string) => { store.delete(key) },
  key: (index: number) => [...store.keys()][index] ?? null,
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, writable: true })
