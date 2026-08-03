import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../domain/entities/category.dart';
import '../../providers/budget_providers.dart';
import '../../providers/category_providers.dart';
import '../../providers/expense_providers.dart';
import '../../widgets/month_switcher_bar.dart';
import '../expense/widgets/expense_list_tile.dart';
import 'widgets/monthly_summary_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Web版と同じく他画面と共有の選択月（selectedMonthProvider）で表示・切り替えできる
    final expensesAsync = ref.watch(selectedMonthExpensesProvider);
    final budgetAsync = ref.watch(selectedMonthBudgetProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};

    return Scaffold(
      appBar: AppBar(
        title: const Text('家計簿'), // Web版のホーム画面と同じくアプリ名を見出しに表示
        bottom: const MonthSwitcherBar(),
      ),
      body: expensesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (expenses) {
          final selectedMonth = ref.watch(selectedMonthProvider);
          final total = expenses.fold<double>(0, (sum, e) => sum + e.amount);
          final recent = expenses.take(5).toList();
          final budget = budgetAsync.valueOrNull?.amount;
          final prevExpenses = ref.watch(previousMonthExpensesProvider).valueOrNull;
          final prevTotal = (prevExpenses == null || prevExpenses.isEmpty)
              ? null // 前月に支出がない場合は前月比を表示しない（Web版と同じ）
              : prevExpenses.fold<double>(0, (sum, e) => sum + e.amount);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              MonthlySummaryCard(
                total: total,
                count: expenses.length,
                month: selectedMonth,
                budget: budget,
                prevTotal: prevTotal,
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('最近の支出', style: Theme.of(context).textTheme.titleMedium),
                  TextButton(
                    onPressed: () => context.go('/expenses'),
                    child: const Text('すべて見る'),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              if (recent.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('支出がありません')),
                )
              else
                ...recent.map(
                  (expense) => ExpenseListTile(
                    expense: expense,
                    category: categoryMap[expense.categoryId],
                    onTap: () => context.push('/expenses/${expense.id}/edit'),
                  ),
                ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/expenses/add'),
        child: const Icon(Icons.add),
      ),
    );
  }
}
