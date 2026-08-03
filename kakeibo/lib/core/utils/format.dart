import 'package:intl/intl.dart';

final _commaFmt = NumberFormat('#,##0');

// 大きな金額を「万」単位に省略表示する（Web版 src/utils/format.ts の formatWan に対応）
// ホーム・統計画面の「合計」見出しにのみ使用し、内訳や一覧の金額は通常のカンマ区切りのまま表示する
String formatWan(num amount) {
  if (amount < 10000) return '¥${_commaFmt.format(amount)}';
  final man = (amount / 10000 * 10).round() / 10; // 小数第1位に丸め
  final manStr = man == man.roundToDouble() ? man.toInt().toString() : man.toStringAsFixed(1);
  return '¥$manStr万';
}
