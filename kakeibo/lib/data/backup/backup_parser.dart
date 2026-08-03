import 'dart:convert';

import '../models/budget_model.dart';
import '../models/category_model.dart';
import '../models/expense_model.dart';
import '../models/recurring_expense_model.dart';

// バックアップJSONを全行型検証しながらIsarモデルへ変換する（Web版 parseBackup 相当）
// 1件でも不正なデータがあれば FormatException を投げてファイル全体を拒否する
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
    decoded = jsonDecode(jsonStr);
  } catch (_) {
    throw const FormatException('JSONとして読み込めないファイルです');
  }
  if (decoded is! Map<String, dynamic>) {
    throw const FormatException('バックアップ形式が不正です（オブジェクトではありません）');
  }

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
