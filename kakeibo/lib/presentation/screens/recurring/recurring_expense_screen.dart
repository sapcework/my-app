import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/category_icons.dart';
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
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('定期支出'),
        actions: [
          // Web版と同じくFABではなくヘッダーの「追加」ピルボタン（カテゴリ画面と統一）
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: () => _showAddDialog(context),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('追加'),
              style: TextButton.styleFrom(
                backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.5),
                foregroundColor: colorScheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
      body: recurringAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.repeat, size: 40, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  const Text('定期支出がありません'),
                ],
              ),
            );
          }
          final total = list.fold<double>(0, (sum, r) => sum + r.amount);
          return Column(
            children: [
              // 月間合計バー（Web版の「月間合計」表示に対応）
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('月間合計', style: Theme.of(context).textTheme.bodySmall),
                    Text(
                      '¥${NumberFormat('#,##0').format(total)}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: list.length,
                  itemBuilder: (context, index) {
                    final r = list[index];
                    return _RecurringExpenseTile(r: r, categoryMap: categoryMap);
                  },
                ),
              ),
            ],
          );
        },
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
    final colorScheme = Theme.of(context).colorScheme;
    final color = Color(category?.colorValue ?? 0xFF9E9E9E);

    // 支出一覧タイル(ExpenseListTile)と同じ配色パターン：
    // カテゴリカラーのタイル型アイコン＋色付きカテゴリ名＋支出名の2行見出し
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: colorScheme.surface,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  kCategoryIconMap[category?.iconName ?? 'more_horiz'] ?? Icons.category,
                  color: color,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      category?.name ?? '不明',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontWeight: FontWeight.bold, color: color),
                    ),
                    Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(
                      '毎月${r.dayOfMonth}日',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
              ),
              Text(
                '¥${fmt.format(r.amount)}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 18),
                visualDensity: VisualDensity.compact,
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => AddRecurringExpenseDialog(editing: r),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 18),
                color: colorScheme.error,
                visualDensity: VisualDensity.compact,
                onPressed: () => _confirmDelete(context, ref),
              ),
            ],
          ),
        ),
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
