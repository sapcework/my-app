import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/category.dart';
import 'repository_providers.dart';

class ExpenseTableData {
  final List<Category> categories;
  final List<DateTime> months; // 昇順ソート済み
  // 'categoryId-year-month' → 支出合計
  final Map<String, double> amounts;
  // 'year-month' → 月次予算
  final Map<String, double> budgets;

  const ExpenseTableData({
    required this.categories,
    required this.months,
    required this.amounts,
    required this.budgets,
  });

  static String _key(int? categoryId, DateTime month) =>
      '${categoryId ?? 0}-${month.year}-${month.month}';
  static String _budgetKey(DateTime month) => '${month.year}-${month.month}';

  double amount(int categoryId, DateTime month) =>
      amounts[_key(categoryId, month)] ?? 0;

  double monthTotal(DateTime month) {
    return categories.fold<double>(0, (s, c) {
      if (c.id == null) return s;
      return s + amount(c.id!, month);
    });
  }

  double categoryAverage(int categoryId) {
    if (months.isEmpty) return 0;
    final nonZero = months.where((m) => amount(categoryId, m) > 0).toList();
    if (nonZero.isEmpty) return 0;
    final total = nonZero.fold<double>(0, (s, m) => s + amount(categoryId, m));
    return total / nonZero.length;
  }

  double totalAverage() {
    if (months.isEmpty) return 0;
    final total = months.fold<double>(0, (s, m) => s + monthTotal(m));
    return total / months.length;
  }

  double? budget(DateTime month) {
    final v = budgets[_budgetKey(month)];
    return (v != null && v > 0) ? v : null;
  }
}

// 全期間の支出データを集計する（autoDispose で画面を離れたらキャッシュ破棄）
final expenseTableDataProvider = FutureProvider.autoDispose<ExpenseTableData>((ref) async {
  final expenseRepo = ref.watch(expenseRepositoryProvider);
  final budgetRepo = ref.watch(budgetRepositoryProvider);
  final categoryRepo = ref.watch(categoryRepositoryProvider);

  final allExpenses = await expenseRepo.watchAll().first;
  final categories = await categoryRepo.watchAll().first;

  // データがある月 + 現在月を収集
  final now = DateTime.now();
  final Set<DateTime> monthSet = {DateTime(now.year, now.month)};
  for (final e in allExpenses) {
    monthSet.add(DateTime(e.date.year, e.date.month));
  }
  final months = (monthSet.toList()..sort());
  // 直近12ヶ月（Web版 TablePage と同じ表示範囲）
  final displayMonths = months.length > 12 ? months.sublist(months.length - 12) : months;

  // カテゴリ×月の集計
  final amounts = <String, double>{};
  for (final e in allExpenses) {
    final month = DateTime(e.date.year, e.date.month);
    if (!displayMonths.contains(month)) continue;
    final key = '${e.categoryId}-${month.year}-${month.month}';
    amounts[key] = (amounts[key] ?? 0) + e.amount;
  }

  // 月次予算
  final budgets = <String, double>{};
  for (final month in displayMonths) {
    final budget = await budgetRepo.getByMonth(month.year, month.month);
    if (budget != null && budget.amount > 0) {
      budgets['${month.year}-${month.month}'] = budget.amount;
    }
  }

  return ExpenseTableData(
    categories: categories,
    months: displayMonths,
    amounts: amounts,
    budgets: budgets,
  );
});
