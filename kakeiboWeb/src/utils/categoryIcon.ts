// カテゴリアイコンの相互変換表。
// Web版は絵文字、Flutter版は Material Icons のフィールド名でアイコンを保持するため、
// バックアップ v2 では両方を書き出し、取り込む側が自分の形式のフィールドを優先して読む。
// （Flutter側の対応表は kakeibo/lib/data/backup/category_icon_map.dart と同一内容）
export const EMOJI_BY_ICON_NAME: Record<string, string> = {
  restaurant: '🍽️',
  ramen_dining: '🍜',
  home: '🏠',
  lightbulb: '💡',
  smartphone: '📱',
  directions_car: '🚗',
  shopping_cart: '🛒',
  checkroom: '👗',
  local_hospital: '🏥',
  shield: '🛡️',
  menu_book: '📚',
  credit_card: '💳',
  sports_esports: '🎮',
  flight: '✈️',
  savings: '💰',
  inventory_2: '📦',
  work: '💼',
  school: '🎓',
  local_cafe: '☕',
  fitness_center: '💪',
  more_horiz: '⋯',
}

export const ICON_NAME_BY_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_BY_ICON_NAME).map(([name, emoji]) => [emoji, name])
)

export const FALLBACK_EMOJI = '📦' // 対応表に無いアイコン名を絵文字にするときの既定値
export const FALLBACK_ICON_NAME = 'inventory_2' // 対応表に無い絵文字をアイコン名にするときの既定値

// 絵文字 → Material Icons 名（書き出し用）
export const toIconName = (emoji: string): string =>
  ICON_NAME_BY_EMOJI[emoji] ?? FALLBACK_ICON_NAME

// Material Icons 名 → 絵文字（取り込み用）
export const toEmoji = (iconName: string): string =>
  EMOJI_BY_ICON_NAME[iconName] ?? FALLBACK_EMOJI
