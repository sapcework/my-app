import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/category.dart';
import '../../../domain/entities/expense.dart';
import '../../providers/category_providers.dart';
import '../../providers/expense_providers.dart';
import '../../widgets/month_switcher_bar.dart';
import 'widgets/expense_list_tile.dart';

class ExpenseListScreen extends ConsumerStatefulWidget {
  const ExpenseListScreen({super.key});

  @override
  ConsumerState<ExpenseListScreen> createState() => _ExpenseListScreenState();
}

class _ExpenseListScreenState extends ConsumerState<ExpenseListScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final expensesAsync = ref.watch(selectedMonthExpensesProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};
    final searchQuery = ref.watch(expenseSearchQueryProvider);
    final categoryFilter = ref.watch(expenseCategoryFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('支出一覧'),
        bottom: const MonthSwitcherBar(),
      ),
      body: Column(
        children: [
          // 検索バー（Web版と同じく常時表示）
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'キーワードで検索...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: searchQuery.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(expenseSearchQueryProvider.notifier).state = '';
                        },
                      ),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: (v) => ref.read(expenseSearchQueryProvider.notifier).state = v,
            ),
          ),
          // カテゴリフィルターチップ
          if (categories.isNotEmpty)
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  FilterChip(
                    label: const Text('すべて'),
                    selected: categoryFilter == null,
                    onSelected: (_) =>
                        ref.read(expenseCategoryFilterProvider.notifier).state = null,
                  ),
                  const SizedBox(width: 8),
                  ...categories.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          avatar: CircleAvatar(
                            radius: 8,
                            backgroundColor: Color(c.colorValue),
                          ),
                          label: Text(c.name),
                          selected: categoryFilter == c.id,
                          onSelected: (_) =>
                              ref.read(expenseCategoryFilterProvider.notifier).state = c.id,
                        ),
                      )),
                ],
              ),
            ),
          Expanded(
            child: expensesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('エラー: $e')),
              data: (allExpenses) {
                final expenses = allExpenses.where((e) {
                  final matchCat = categoryFilter == null || e.categoryId == categoryFilter;
                  final q = searchQuery.trim().toLowerCase();
                  final matchQuery = q.isEmpty ||
                      (e.itemName?.toLowerCase().contains(q) ?? false) ||
                      (e.memo?.toLowerCase().contains(q) ?? false) ||
                      e.amount.toStringAsFixed(0).contains(q);
                  return matchCat && matchQuery;
                }).toList();

                return _ExpenseListBody(expenses: expenses, categoryMap: categoryMap);
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/expenses/add'),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ExpenseListBody extends StatelessWidget {
  final List<Expense> expenses;
  final Map<int, Category> categoryMap;

  const _ExpenseListBody({required this.expenses, required this.categoryMap});

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];
  static final _dateFmt = DateFormat('yyyy/MM/dd');

  String _formatDateWithDay(DateTime date) {
    final weekday = _weekdays[date.weekday - 1];
    return '${_dateFmt.format(date)}($weekday)';
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final fmt = NumberFormat('#,##0');

    if (expenses.isEmpty) {
      return const Center(child: Text('該当する支出がありません'));
    }

    final total = expenses.fold<double>(0, (sum, e) => sum + e.amount);

    // 日付でグループ化（expenses は日付降順前提）
    final groups = <({DateTime date, List<Expense> items})>[];
    for (final e in expenses) {
      final dateKey = DateTime(e.date.year, e.date.month, e.date.day);
      if (groups.isNotEmpty && groups.last.date == dateKey) {
        groups.last.items.add(e);
      } else {
        groups.add((date: dateKey, items: [e]));
      }
    }

    return Column(
      children: [
        // 件数・合計バー
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: colorScheme.surfaceContainerHighest,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${expenses.length}件', style: textTheme.bodyMedium),
              Text(
                '合計 ¥${fmt.format(total)}',
                style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        // 日付グループリスト
        Expanded(
          child: ListView.builder(
            itemCount: groups.length,
            itemBuilder: (context, i) {
              final group = groups[i];
              final dayTotal = group.items.fold<double>(0, (s, e) => s + e.amount);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 日付ヘッダー（帯型）
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Text(
                          _formatDateWithDay(group.date),
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '¥${fmt.format(dayTotal)}',
                          style: textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // その日の支出リスト
                  ...group.items.map(
                    (expense) => ExpenseListTile(
                      expense: expense,
                      category: categoryMap[expense.categoryId],
                      onTap: () => context.push('/expenses/${expense.id}/edit'),
                      showDeleteButton: true,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}
