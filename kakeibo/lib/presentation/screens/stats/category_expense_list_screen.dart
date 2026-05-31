import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/expense.dart';
import '../../providers/expense_providers.dart';

class CategoryExpenseListArgs {
  final int categoryId;
  final String categoryName;
  final int colorValue;

  const CategoryExpenseListArgs({
    required this.categoryId,
    required this.categoryName,
    required this.colorValue,
  });
}

class CategoryExpenseListScreen extends ConsumerWidget {
  final CategoryExpenseListArgs args;
  const CategoryExpenseListScreen({super.key, required this.args});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allExpensesAsync = ref.watch(selectedMonthExpensesProvider);
    final selectedMonth = ref.watch(selectedMonthProvider);
    final fmt = NumberFormat('#,##0');

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 10,
              backgroundColor: Color(args.colorValue),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(args.categoryName),
                Text(
                  DateFormat('yyyy年M月').format(selectedMonth),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ),
      ),
      body: allExpensesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (all) {
          final expenses = all.where((e) => e.categoryId == args.categoryId).toList();

          if (expenses.isEmpty) {
            return const Center(child: Text('この月の支出はありません'));
          }

          final total = expenses.fold<double>(0, (s, e) => s + e.amount);

          return Column(
            children: [
              // 合計バー
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${expenses.length}件',
                        style: Theme.of(context).textTheme.bodyMedium),
                    Text(
                      '合計 ¥${fmt.format(total)}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: expenses.length,
                  itemBuilder: (context, index) {
                    final expense = expenses[index];
                    return _ExpenseTile(expense: expense, fmt: fmt);
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ExpenseTile extends StatelessWidget {
  final Expense expense;
  final NumberFormat fmt;

  const _ExpenseTile({required this.expense, required this.fmt});

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  @override
  Widget build(BuildContext context) {
    final weekday = _weekdays[expense.date.weekday - 1];
    final dateStr = '${DateFormat('M/d').format(expense.date)}($weekday)';
    final title = expense.itemName?.isNotEmpty == true
        ? expense.itemName!
        : expense.memo?.isNotEmpty == true
            ? expense.memo!
            : '支出';

    return ListTile(
      leading: Text(dateStr, style: Theme.of(context).textTheme.bodySmall),
      title: Text(title),
      subtitle: expense.itemName != null && expense.memo?.isNotEmpty == true
          ? Text(expense.memo!, maxLines: 1, overflow: TextOverflow.ellipsis)
          : null,
      trailing: Text(
        '¥${fmt.format(expense.amount)}',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
      ),
      onTap: () => context.push('/expenses/${expense.id}/edit'),
    );
  }
}
