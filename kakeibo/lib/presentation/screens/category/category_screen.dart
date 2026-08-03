import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/category.dart';
import '../../providers/category_providers.dart';
import '../../providers/repository_providers.dart';
import 'widgets/add_category_dialog.dart';
import 'widgets/category_list_tile.dart';

class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);

    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('カテゴリ'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => const AddCategoryDialog(),
              ),
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
      body: categoriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (categories) => categories.isEmpty
            ? const Center(child: Text('カテゴリがありません'))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: categories.length,
                itemBuilder: (context, index) => CategoryListTile(
                  category: categories[index],
                  onTap: () => showDialog<void>( // タップで編集ダイアログを開く
                    context: context,
                    builder: (_) => AddCategoryDialog(initial: categories[index]),
                  ),
                  onDelete: () => _confirmDelete(context, ref, categories[index]),
                ),
              ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Category category,
  ) async {
    if (category.id == null) return;

    // 使用中の支出件数を取得して警告文に反映（Web版のカテゴリ削除警告に対応）
    final expenses = await ref.read(expenseRepositoryProvider).watchAll().first;
    final usedCount = expenses.where((e) => e.categoryId == category.id).length;
    if (!context.mounted) return;

    final message = usedCount > 0
        ? 'このカテゴリは$usedCount件の支出で使用されています。\n'
            '削除後も支出データ自体は残りますが、カテゴリ表示は「不明」になります。\n\n'
            '「${category.name}」を削除しますか？'
        : '「${category.name}」を削除しますか？';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('削除の確認'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('削除'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(deleteCategoryUseCaseProvider).call(category.id!);
    }
  }
}
