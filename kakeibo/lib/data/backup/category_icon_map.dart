// カテゴリアイコンの相互変換表。
// このアプリは Material Icons のフィールド名、Web版は絵文字でアイコンを保持するため、
// バックアップv2では両方を書き出し、取り込む側が自分の形式のフィールドを優先して読む。
// （Web版の対応表は kakeiboWeb/src/utils/categoryIcon.ts と同一内容）
const kEmojiByIconName = <String, String>{
  'restaurant': '🍽️',
  'ramen_dining': '🍜',
  'home': '🏠',
  'lightbulb': '💡',
  'smartphone': '📱',
  'directions_car': '🚗',
  'shopping_cart': '🛒',
  'checkroom': '👗',
  'local_hospital': '🏥',
  'shield': '🛡️',
  'menu_book': '📚',
  'credit_card': '💳',
  'sports_esports': '🎮',
  'flight': '✈️',
  'savings': '💰',
  'inventory_2': '📦',
  'work': '💼',
  'school': '🎓',
  'local_cafe': '☕',
  'fitness_center': '💪',
  'more_horiz': '⋯',
};

final kIconNameByEmoji = <String, String>{
  for (final e in kEmojiByIconName.entries) e.value: e.key,
};

const kFallbackEmoji = '📦'; // 対応表に無いアイコン名を絵文字にするときの既定値
const kFallbackIconName = 'inventory_2'; // 対応表に無い絵文字をアイコン名にするときの既定値

// Material Icons 名 → 絵文字（書き出し用）
String emojiFromIconName(String iconName) =>
    kEmojiByIconName[iconName] ?? kFallbackEmoji;

// 絵文字 → Material Icons 名（取り込み用）
String iconNameFromEmoji(String emoji) =>
    kIconNameByEmoji[emoji] ?? kFallbackIconName;

// ARGB int → '#RRGGBB'
String hexFromColorValue(int colorValue) =>
    '#${(colorValue & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

// '#RRGGBB' / '#AARRGGBB' → ARGB int。解釈できなければ null
int? colorValueFromHex(String hex) {
  final body = hex.startsWith('#') ? hex.substring(1) : hex;
  if (body.length != 6 && body.length != 8) return null;
  final parsed = int.tryParse(body, radix: 16);
  if (parsed == null) return null;
  return body.length == 6 ? 0xFF000000 | parsed : parsed;
}
