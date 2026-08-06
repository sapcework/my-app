import { describe, it, expect } from 'vitest'
import { parseBackup, buildBackup } from './backup'

const validExpense = {
  id: 'e1',
  amount: 1200,
  categoryId: '1',
  itemName: 'スーパー',
  note: '',
  date: '2026-07-15',
  createdAt: '2026-07-15T10:00:00.000Z',
}

const validBackup = {
  version: '1',
  exportedAt: '2026-07-19T00:00:00.000Z',
  expenses: [validExpense],
  categories: [{ id: '1', name: '食費', color: '#FF9800', icon: '🍽️' }],
  budgets: [{ month: '2026-07', amount: 50000 }],
  recurring: [{ id: 'r1', amount: 80000, categoryId: '3', name: '家賃', dayOfMonth: 27 }],
}

// アプリ（Flutter）版が書き出す v2 形式のサンプル。IDは整数の文字列、アイコンは Material Icons 名。
const flutterV2 = {
  version: '2',
  exportedAt: '2026-08-04T00:00:00.000Z',
  app: 'kakeibo-flutter',
  categories: [
    { id: '2', name: '交通費', color: '#2196F3', icon: '🚗', iconName: 'directions_car', sortOrder: 1 },
    { id: '1', name: '食費', color: '#FF9800', icon: '🍽️', iconName: 'restaurant', sortOrder: 0 },
  ],
  expenses: [
    {
      id: '10', amount: 1200, categoryId: '1', itemName: 'ランチ', note: 'メモ',
      date: '2026-08-04', createdAt: '2026-08-04T09:00:00.000Z',
    },
  ],
  budgets: [{ month: '2026-08', amount: 50000 }],
  recurring: [
    { id: '5', name: '家賃', amount: 80000, categoryId: '2', dayOfMonth: 27, isActive: true },
    { id: '6', name: '休止中のサブスク', amount: 500, categoryId: '2', dayOfMonth: 1, isActive: false },
  ],
}

describe('parseBackup（v1）', () => {
  it('正しいバックアップを受理する', () => {
    const r = parseBackup(JSON.stringify(validBackup))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.expenses).toHaveLength(1)
      expect(r.data.budgets[0].amount).toBe(50000)
    }
  })

  it('budgets/recurring が無い旧形式も受理する', () => {
    const rest: Record<string, unknown> = { ...validBackup }
    delete rest.budgets
    delete rest.recurring
    const r = parseBackup(JSON.stringify(rest))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.budgets).toEqual([])
      expect(r.data.recurring).toEqual([])
    }
  })

  it('JSONでないファイルを拒否する', () => {
    const r = parseBackup('not json at all')
    expect(r.ok).toBe(false)
  })

  it('金額が文字列の支出を拒否する', () => {
    const bad = { ...validBackup, expenses: [{ ...validExpense, amount: '1200' }] }
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('支出データ')
  })

  it('負の金額を拒否する', () => {
    const bad = { ...validBackup, expenses: [{ ...validExpense, amount: -100 }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('日付形式が不正な支出を拒否し、何件目かを示す', () => {
    const bad = { ...validBackup, expenses: [validExpense, { ...validExpense, id: 'e2', date: '2026/07/15' }] }
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('2件目')
  })

  it('カテゴリ名が空のカテゴリを拒否する', () => {
    const bad = { ...validBackup, categories: [{ id: '1', name: '', color: '#fff', icon: '🍽️' }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('dayOfMonth が範囲外の定期支出を拒否する', () => {
    const bad = { ...validBackup, recurring: [{ ...validBackup.recurring[0], dayOfMonth: 32 }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('expenses が配列でない場合を拒否する', () => {
    const bad = { ...validBackup, expenses: 'x' }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  it('アプリ版の旧形式(v1)は見分けて案内する', () => {
    const flutterV1 = {
      version: '1',
      expenses: [{ id: 1, amount: 1200, categoryId: 1, memo: null, date: '2026-08-04T00:00:00.000', createdAt: '2026-08-04T00:00:00.000' }],
      categories: [{ id: 1, name: '食費', colorValue: 4294951168, iconName: 'restaurant', sortOrder: 0, createdAt: '2026-08-04T00:00:00.000' }],
      budgets: [],
      recurring: [],
    }
    const r = parseBackup(JSON.stringify(flutterV1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('アプリ版の旧形式')
  })
})

describe('parseBackup（v2 = アプリ版との共通形式）', () => {
  it('アプリ版のバックアップを取り込める', () => {
    const r = parseBackup(JSON.stringify(flutterV2))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.expenses).toHaveLength(1)
    expect(r.data.categories.map((c) => c.name)).toEqual(['食費', '交通費']) // sortOrder 順に並び替えられる
    expect(r.data.budgets[0]).toEqual({ month: '2026-08', amount: 50000 })
  })

  it('支出・定期支出のIDはUUIDに振り直し、カテゴリ参照は保つ', () => {
    const r = parseBackup(JSON.stringify(flutterV2))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const food = r.data.categories.find((c) => c.name === '食費')!
    expect(food.id).toBe('1') // カテゴリIDはそのまま（Supabaseはテキスト型で運用中）
    expect(r.data.expenses[0].id).not.toBe('10') // 支出IDは採番し直す
    expect(r.data.expenses[0].id).toMatch(/^[0-9a-f-]{20,}$/i)
    expect(r.data.expenses[0].categoryId).toBe('1') // 参照は壊れない
    expect(r.data.recurring[0].id).not.toBe('5')
  })

  it('無効な定期支出は取り込まない', () => {
    const r = parseBackup(JSON.stringify(flutterV2))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.recurring).toHaveLength(1)
    expect(r.data.recurring[0].name).toBe('家賃')
  })

  it('iconName だけでも絵文字に変換して取り込める', () => {
    const data = {
      ...flutterV2,
      categories: [{ id: '1', name: '食費', color: '#FF9800', iconName: 'restaurant', sortOrder: 0 }],
      expenses: [],
      recurring: [],
    }
    const r = parseBackup(JSON.stringify(data))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.categories[0].icon).toBe('🍽️')
  })

  it('色が #RRGGBB でないカテゴリを拒否する', () => {
    const bad = { ...flutterV2, categories: [{ ...flutterV2.categories[0], color: 'orange' }] }
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('カテゴリ')
  })

  it('未知のバージョンを拒否する', () => {
    const r = parseBackup(JSON.stringify({ ...flutterV2, version: '99' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('99')
  })
})

describe('buildBackup', () => {
  const expenseId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301' // 実際の支出IDはUUID（振り直されない）
  const recurringId = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'
  const web = {
    expenses: [{ id: expenseId, amount: 1200, categoryId: '1', itemName: 'ランチ', note: '', date: '2026-08-04', createdAt: '2026-08-04T09:00:00.000Z' }],
    categories: [{ id: '1', name: '食費', color: '#FF9800', icon: '🍽️' }],
    budgets: [{ month: '2026-08', amount: 50000 }],
    recurring: [{ id: recurringId, name: '家賃', amount: 80000, categoryId: '1', dayOfMonth: 27 }],
  }

  it('v2形式で書き出す（アプリ版が読むフィールドを含む）', () => {
    const out = buildBackup(web)
    expect(out.version).toBe('2')
    expect(out.categories[0].iconName).toBe('restaurant')
    expect(out.categories[0].sortOrder).toBe(0)
    expect(out.recurring[0].isActive).toBe(true)
  })

  it('書き出したものを読み戻せる（往復して内容が保たれる）', () => {
    const r = parseBackup(JSON.stringify(buildBackup(web)))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.expenses).toEqual(web.expenses)
    expect(r.data.categories).toEqual(web.categories)
    expect(r.data.budgets).toEqual(web.budgets)
    expect(r.data.recurring[0].name).toBe('家賃')
  })
})
