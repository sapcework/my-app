import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/category.dart';
import '../../../domain/entities/recurring_expense.dart';
import '../../providers/category_providers.dart';
import '../../providers/recurring_expense_providers.dart';
import 'widgets/add_recurring_expense_dialog.dart';

class RecurringExpenseScreen extends ConsumerWidget {
  const RecurringExpenseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recurringAsync = ref.watch(recurringExpensesProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};

    return Scaffold(
      appBar: AppBar(title: const Text('定期支出')),
      body: recurringAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('定期支出が登録されていません'));
          }
          return ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, index) {
              final r = list[index];
              return _RecurringExpenseTile(r: r, categoryMap: categoryMap);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddDialog(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (_) => const AddRecurringExpenseDialog(),
    );
  }
}

class _RecurringExpenseTile extends ConsumerWidget {
  final RecurringExpense r;
  final Map<int, Category> categoryMap;

  const _RecurringExpenseTile({required this.r, required this.categoryMap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final category = categoryMap[r.categoryId];
    final fmt = NumberFormat('#,##0');

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: category != null ? Color(category.colorValue) : Colors.grey,
        radius: 20,
        child: const Icon(
          Icons.repeat,
          color: Colors.white,
          size: 16,
        ),
      ),
      title: Text(r.name),
      subtitle: Text('毎月${r.dayOfMonth}日 • ${category?.name ?? ''}'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '¥${fmt.format(r.amount)}',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => AddRecurringExpenseDialog(editing: r),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () => _confirmDelete(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('削除の確認'),
        content: Text('「${r.name}」を削除しますか？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('削除'),
          ),
        ],
      ),
    );
    if (confirmed == true && r.id != null) {
      await ref.read(deleteRecurringExpenseUseCaseProvider).call(r.id!);
    }
  }
}
