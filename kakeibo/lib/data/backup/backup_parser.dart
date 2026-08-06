import 'dart:convert';

import '../models/budget_model.dart';
import '../models/category_model.dart';
import '../models/expense_model.dart';
import '../models/recurring_expense_model.dart';
import 'category_icon_map.dart';

// バックアップJSONを全行型検証しながらIsarモデルへ変換する。
// version:"2"（Web版と共通の移行フォーマット / 仕様: docs/backup-format-v2.md）と
// version:"1"（このアプリの旧形式）の両方を読める。
// 1件でも不正なデータがあれば FormatException を投げてファイル全体を拒否する。
class BackupData {
  final List<ExpenseModel> expenses;
  final List<CategoryModel> categories;
  final List<BudgetModel> budgets;
  final List<RecurringExpenseModel> recurring;

  const BackupData({
    required this.expenses,
    required this.categories,
    required this.budgets,
    required this.recurring,
  });
}

BackupData parseBackup(String jsonStr) {
  final dynamic decoded;
  try {
    // 他アプリ経由のファイルはBOM付きのことがあるので落としてから読む
    decoded = jsonDecode(
        jsonStr.startsWith('\u{FEFF}') ? jsonStr.substring(1) : jsonStr);
  } catch (_) {
    throw const FormatException('JSONとして読み込めないファイルです');
  }
  if (decoded is! Map<String, dynamic>) {
    throw const FormatException('バックアップ形式が不正です（オブジェクトではありません）');
  }

  final version = decoded['version'] is String ? decoded['version'] as String : '1';
  if (version == '2') return _parseV2(decoded);
  if (version != '1') {
    throw FormatException('対応していないバックアップ形式です（version: $version）');
  }

  // version:"1" はこのアプリとWeb版で中身が別物なので、Web版の旧形式は見分けて案内する
  if (_looksLikeWebV1(decoded)) {
    throw const FormatException(
        'Web版の旧形式（v1）です。Web版で再度バックアップを取り直してください（新しい共通形式で書き出されます）');
  }
  return _parseV1(decoded);
}

// Web版が version:"1" で書き出していた旧形式かどうか（IDが文字列・カテゴリが color を持つ）
bool _looksLikeWebV1(Map<String, dynamic> decoded) {
  final rows = [
    if (decoded['expenses'] is List) ...(decoded['expenses'] as List),
    if (decoded['categories'] is List) ...(decoded['categories'] as List),
  ];
  return rows.any((r) =>
      r is Map<String, dynamic> &&
      (r['id'] is String || r.containsKey('color') || r.containsKey('note')));
}

// ============================================================
// v1（このアプリの旧形式）
// ============================================================

BackupData _parseV1(Map<String, dynamic> decoded) {
  final expensesRaw = _requireList(decoded, 'expenses', '支出');
  final categoriesRaw = _requireList(decoded, 'categories', 'カテゴリ');
  final budgetsRaw = _requireList(decoded, 'budgets', '予算');
  final recurringRaw = _requireList(decoded, 'recurring', '定期支出');

  return BackupData(
    expenses: List.generate(expensesRaw.length, (i) => _parseExpense(expensesRaw[i], i)),
    categories: List.generate(categoriesRaw.length, (i) => _parseCategory(categoriesRaw[i], i)),
    budgets: List.generate(budgetsRaw.length, (i) => _parseBudget(budgetsRaw[i], i)),
    recurring: List.generate(recurringRaw.length, (i) => _parseRecurring(recurringRaw[i], i)),
  );
}

List<dynamic> _requireList(Map<String, dynamic> map, String key, String label) {
  final value = map[key];
  if (value is! List) throw FormatException('$labelデータ（$key）がありません');
  return value;
}

Never _fail(String label, int index, String reason) {
  throw FormatException('$labelデータの${index + 1}件目が不正です（$reason）');
}

Map<String, dynamic> _asMap(dynamic row, String label, int index) {
  if (row is! Map<String, dynamic>) _fail(label, index, 'オブジェクトではありません');
  return row;
}

int _reqInt(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! int) _fail(label, index, '$key が整数ではありません');
  return v;
}

double _reqAmount(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! num || !v.isFinite || v < 0) _fail(label, index, '$key が正しい金額ではありません');
  return v.toDouble();
}

String _reqString(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! String || v.isEmpty) _fail(label, index, '$key が文字列ではありません');
  return v;
}

String? _optString(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v == null) return null;
  if (v is! String) _fail(label, index, '$key が文字列ではありません');
  return v;
}

DateTime _reqDate(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  final parsed = v is String ? DateTime.tryParse(v) : null;
  if (parsed == null) _fail(label, index, '$key が日付形式ではありません');
  return parsed;
}

ExpenseModel _parseExpense(dynamic row, int index) {
  const label = '支出';
  final m = _asMap(row, label, index);
  return ExpenseModel()
    ..id = _reqInt(m, 'id', label, index)
    ..amount = _reqAmount(m, 'amount', label, index)
    ..categoryId = _reqInt(m, 'categoryId', label, index)
    ..itemName = _optString(m, 'itemName', label, index)
    ..memo = _optString(m, 'memo', label, index)
    ..date = _reqDate(m, 'date', label, index)
    ..createdAt = _reqDate(m, 'createdAt', label, index);
}

CategoryModel _parseCategory(dynamic row, int index) {
  const label = 'カテゴリ';
  final m = _asMap(row, label, index);
  return CategoryModel()
    ..id = _reqInt(m, 'id', label, index)
    ..name = _reqString(m, 'name', label, index)
    ..colorValue = _reqInt(m, 'colorValue', label, index)
    ..iconName = _reqString(m, 'iconName', label, index)
    ..sortOrder = (m['sortOrder'] is num) ? (m['sortOrder'] as num).toInt() : 0
    ..createdAt = _reqDate(m, 'createdAt', label, index);
}

BudgetModel _parseBudget(dynamic row, int index) {
  const label = '予算';
  final m = _asMap(row, label, index);
  final year = _reqInt(m, 'year', label, index);
  final month = _reqInt(m, 'month', label, index);
  if (year < 2000 || year > 2100) _fail(label, index, 'year が範囲外です');
  if (month < 1 || month > 12) _fail(label, index, 'month が範囲外です');
  return BudgetModel()
    ..id = _reqInt(m, 'id', label, index)
    ..year = year
    ..month = month
    ..amount = _reqAmount(m, 'amount', label, index);
}

RecurringExpenseModel _parseRecurring(dynamic row, int index) {
  const label = '定期支出';
  final m = _asMap(row, label, index);
  final dayOfMonth = _reqInt(m, 'dayOfMonth', label, index);
  if (dayOfMonth < 1 || dayOfMonth > 31) _fail(label, index, 'dayOfMonth が範囲外です');
  final isActive = m['isActive'];
  if (isActive is! bool) _fail(label, index, 'isActive が真偽値ではありません');
  return RecurringExpenseModel()
    ..id = _reqInt(m, 'id', label, index)
    ..name = _reqString(m, 'name', label, index)
    ..amount = _reqAmount(m, 'amount', label, index)
    ..categoryId = _reqInt(m, 'categoryId', label, index)
    ..dayOfMonth = dayOfMonth
    ..isActive = isActive;
}

// ============================================================
// v2（Web版と共通の移行フォーマット）
// ============================================================
// IDは「ファイル内でのみ有効な参照キー」と定義された文字列なので、
// 取り込み時にこのアプリのID体系（Isarの整数）へ振り直し、参照も付け替える。

// 文字列IDを整数IDへ割り当てる。整数として読めるIDはその値を維持し、
// UUID などはぶつからない番号を新しく採番する。
class _IdAssigner {
  final _assigned = <String, int>{};
  final _used = <int>{};
  int _next = 1;

  void reserve(Iterable<String> keys) {
    for (final key in keys) { // 1周目: 整数として読めるIDをそのまま確保する
      final parsed = int.tryParse(key);
      if (parsed != null && parsed > 0 && !_used.contains(parsed)) {
        _assigned[key] = parsed;
        _used.add(parsed);
      }
    }
  }

  int? lookup(String key) => _assigned[key]; // 参照解決用（未登録なら採番しない）

  int idFor(String key) {
    final existing = _assigned[key];
    if (existing != null) return existing;
    while (_used.contains(_next)) {
      _next++;
    }
    _assigned[key] = _next;
    _used.add(_next);
    return _next;
  }
}

const _orphanCategoryId = 0; // 参照先カテゴリが無い支出の行き先（画面上は「不明」表示になる）

List<dynamic> _optList(Map<String, dynamic> map, String key, String label) {
  final value = map[key];
  if (value == null) return const [];
  if (value is! List) throw FormatException('$labelデータ（$key）の形式が不正です');
  return value;
}

String _reqIdString(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! String || v.isEmpty) _fail(label, index, '$key が文字列ではありません');
  return v;
}

DateTime _reqDateOnly(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v)) {
    _fail(label, index, '$key が YYYY-MM-DD 形式ではありません');
  }
  final parsed = DateTime.tryParse(v);
  if (parsed == null) _fail(label, index, '$key が日付として解釈できません');
  return DateTime(parsed.year, parsed.month, parsed.day); // ローカル日付の0時に揃える
}

(int, int) _reqMonth(Map<String, dynamic> m, String key, String label, int index) {
  final v = m[key];
  if (v is! String || !RegExp(r'^\d{4}-\d{2}$').hasMatch(v)) {
    _fail(label, index, '$key が YYYY-MM 形式ではありません');
  }
  final year = int.parse(v.substring(0, 4));
  final month = int.parse(v.substring(5, 7));
  if (year < 2000 || year > 2100) _fail(label, index, 'year が範囲外です');
  if (month < 1 || month > 12) _fail(label, index, 'month が範囲外です');
  return (year, month);
}

BackupData _parseV2(Map<String, dynamic> decoded) {
  final categoriesRaw = _optList(decoded, 'categories', 'カテゴリ');
  final expensesRaw = _optList(decoded, 'expenses', '支出');
  final budgetsRaw = _optList(decoded, 'budgets', '予算');
  final recurringRaw = _optList(decoded, 'recurring', '定期支出');

  // ── カテゴリ ──
  const catLabel = 'カテゴリ';
  final catMaps = List.generate(
      categoriesRaw.length, (i) => _asMap(categoriesRaw[i], catLabel, i));
  final catIds = _IdAssigner()
    ..reserve(List.generate(
        catMaps.length, (i) => _reqIdString(catMaps[i], 'id', catLabel, i)));

  final categories = <CategoryModel>[];
  for (var i = 0; i < catMaps.length; i++) {
    final m = catMaps[i];
    final colorValue = colorValueFromHex(_reqString(m, 'color', catLabel, i));
    if (colorValue == null) _fail(catLabel, i, 'color が #RRGGBB 形式ではありません');

    final iconName = _optString(m, 'iconName', catLabel, i);
    final emoji = _optString(m, 'icon', catLabel, i);
    if ((iconName == null || iconName.isEmpty) && (emoji == null || emoji.isEmpty)) {
      _fail(catLabel, i, 'icon / iconName のどちらもありません');
    }

    categories.add(CategoryModel()
      ..id = catIds.idFor(_reqIdString(m, 'id', catLabel, i))
      ..name = _reqString(m, 'name', catLabel, i)
      ..colorValue = colorValue
      ..iconName = (iconName != null && iconName.isNotEmpty)
          ? iconName
          : iconNameFromEmoji(emoji!) // Web版から来た場合は絵文字から変換する
      ..sortOrder = (m['sortOrder'] is num) ? (m['sortOrder'] as num).toInt() : i
      ..createdAt = (m['createdAt'] is String
              ? DateTime.tryParse(m['createdAt'] as String)
              : null) ??
          DateTime.now());
  }

  // ── 支出 ──
  const expLabel = '支出';
  final expMaps =
      List.generate(expensesRaw.length, (i) => _asMap(expensesRaw[i], expLabel, i));
  final expIds = _IdAssigner()
    ..reserve(List.generate(
        expMaps.length, (i) => _reqIdString(expMaps[i], 'id', expLabel, i)));

  final expenses = <ExpenseModel>[];
  for (var i = 0; i < expMaps.length; i++) {
    final m = expMaps[i];
    final itemName = _optString(m, 'itemName', expLabel, i);
    final note = _optString(m, 'note', expLabel, i);
    final date = _reqDateOnly(m, 'date', expLabel, i);
    expenses.add(ExpenseModel()
      ..id = expIds.idFor(_reqIdString(m, 'id', expLabel, i))
      ..amount = _reqAmount(m, 'amount', expLabel, i)
      ..categoryId =
          catIds.lookup(_reqIdString(m, 'categoryId', expLabel, i)) ?? _orphanCategoryId
      ..itemName = (itemName == null || itemName.isEmpty) ? null : itemName
      ..memo = (note == null || note.isEmpty) ? null : note
      ..date = date
      ..createdAt = (m['createdAt'] is String
              ? DateTime.tryParse(m['createdAt'] as String)
              : null) ??
          date);
  }

  // ── 予算 ──
  const budLabel = '予算';
  final budgets = <BudgetModel>[];
  final seenMonths = <String>{};
  for (var i = 0; i < budgetsRaw.length; i++) {
    final m = _asMap(budgetsRaw[i], budLabel, i);
    final (year, month) = _reqMonth(m, 'month', budLabel, i);
    final amount = _reqAmount(m, 'amount', budLabel, i);
    if (!seenMonths.add('$year-$month')) continue; // 同じ月が重複していたら先勝ちにする
    budgets.add(BudgetModel()
      ..year = year
      ..month = month
      ..amount = amount);
  }

  // ── 定期支出 ──
  const recLabel = '定期支出';
  final recMaps =
      List.generate(recurringRaw.length, (i) => _asMap(recurringRaw[i], recLabel, i));
  final recIds = _IdAssigner()
    ..reserve(List.generate(
        recMaps.length, (i) => _reqIdString(recMaps[i], 'id', recLabel, i)));

  final recurring = <RecurringExpenseModel>[];
  for (var i = 0; i < recMaps.length; i++) {
    final m = recMaps[i];
    final dayOfMonth = _reqInt(m, 'dayOfMonth', recLabel, i);
    if (dayOfMonth < 1 || dayOfMonth > 31) _fail(recLabel, i, 'dayOfMonth が範囲外です');
    final isActive = m['isActive'];
    if (isActive != null && isActive is! bool) {
      _fail(recLabel, i, 'isActive が真偽値ではありません');
    }
    // 最後に自動登録した年月。取り込まないと復元後の初回起動で今月分が二重登録される
    final (lastYear, lastMonth) = m['lastGeneratedMonth'] == null
        ? (0, 0)
        : _reqMonth(m, 'lastGeneratedMonth', recLabel, i);

    recurring.add(RecurringExpenseModel()
      ..id = recIds.idFor(_reqIdString(m, 'id', recLabel, i))
      ..name = _reqString(m, 'name', recLabel, i)
      ..amount = _reqAmount(m, 'amount', recLabel, i)
      ..categoryId =
          catIds.lookup(_reqIdString(m, 'categoryId', recLabel, i)) ?? _orphanCategoryId
      ..dayOfMonth = dayOfMonth
      ..isActive = isActive as bool? ?? true // Web版には無効の概念が無いので既定は有効
      ..lastRegisteredYear = lastYear
      ..lastRegisteredMonth = lastMonth);
  }

  return BackupData(
    expenses: expenses,
    categories: categories,
    budgets: budgets,
    recurring: recurring,
  );
}
