import 'package:intl/intl.dart';

final _commaFmt = NumberFormat('#,##0');

String formatYen(num amount) => '¥${_commaFmt.format(amount)}'; // 「¥12,345」のようにカンマ区切りで全桁出す（以前の formatWan は「¥1.2万」と丸めて桁が消えるため廃止）
