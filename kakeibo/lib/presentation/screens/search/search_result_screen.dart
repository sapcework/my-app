import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/category.dart';
import '../../../domain/usecases/expense/search_expenses.dart';
import '../../providers/category_providers.dart';
import '../../providers/search_providers.dart';
import '../expense/widgets/expense_list_tile.dart';

class SearchResultScreen extends ConsumerWidget { // 検索結果：件数・合計・使っている条件と、当てはまった支出の一覧
  const SearchResultScreen({super.key});

  static List<String> describe(SearchCondition c, List<Category> categories) { // 使っている条件を短い文に（指定の無い条件は出さない）
    final dateFmt = DateFormat('yyyy/MM/dd');
    final yen = NumberFormat('#,##0');
    final parts = <String>[];
    if (c.from != null || c.to != null) {
      parts.add('日付 ${c.from == null ? '' : dateFmt.format(c.from!)}〜${c.to == null ? '' : dateFmt.format(c.to!)}');
    }
    if (c.minAmount != null || c.maxAmount != null) {
      parts.add('金額 ${c.minAmount == null ? '' : '¥${yen.format(c.minAmount)}'}〜${c.maxAmount == null ? '' : '¥${yen.format(c.maxAmount)}'}');
    }
    final chosen = categories.where((cat) => !c.excludedCategoryIds.contains(cat.id)).toList();
    if (chosen.length < categories.length) parts.add('分類 ${chosen.map((cat) => cat.name).join('・')}');
    if (c.itemKeyword.trim().isNotEmpty) parts.add('項目名「${c.itemKeyword.trim()}」を${c.itemMode.label}');
    if (c.memoKeyword.trim().isNotEmpty) parts.add('メモ「${c.memoKeyword.trim()}」を${c.memoMode.label}');
    parts.add(c.sort.label);
    return parts;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultsAsync = ref.watch(searchResultsProvider);
    final condition = ref.watch(searchConditionProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};
    final theme = Theme.of(context);
    final fmt = NumberFormat('#,##0');

    return Scaffold(
      appBar: AppBar(title: const Text('検索結果')),
      body: resultsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (results) {
          final total = results.fold<double>(0, (s, e) => s + e.amount);
          return Column(
            children: [
              Container( // 件数と合計（カテゴリ別明細画面と同じ帯）
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: theme.colorScheme.surfaceContainerHighest,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${results.length}件', style: theme.textTheme.bodyMedium),
                        Text('合計 ¥${fmt.format(total)}', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      describe(condition, categories).join(' / '),
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: results.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.search_off, size: 48, color: theme.colorScheme.outline),
                            const SizedBox(height: 8),
                            const Text('条件に合う支出はありません'),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: results.length,
                        itemBuilder: (_, i) {
                          final expense = results[i];
                          return ExpenseListTile(
                            expense: expense,
                            category: categoryMap[expense.categoryId],
                            onTap: () => context.push('/expenses/${expense.id}/edit'),
                            showDeleteButton: true,
                          );
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
