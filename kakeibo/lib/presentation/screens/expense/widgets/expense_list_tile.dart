import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';
import '../../../../../domain/entities/expense.dart';
import '../../../providers/repository_providers.dart';

class ExpenseListTile extends ConsumerWidget {
  final Expense expense;
  final Category? category; // 削除済みカテゴリはnullになりうる
  final VoidCallback? onTap;
  final bool showDeleteButton; // 支出一覧ではtrue、ホームの「最近の支出」ではfalse

  const ExpenseListTile({
    super.key,
    required this.expense,
    this.category,
    this.onTap,
    this.showDeleteButton = false,
  });

  // Web版と同じ「削除→Undoトースト」のクイック削除（支出一覧タイル用）
  Future<void> _quickDelete(BuildContext context, WidgetRef ref) async {
    if (expense.id == null) return;
    final repo = ref.read(expenseRepositoryProvider);
    final messenger = ScaffoldMessenger.of(context);
    await repo.delete(expense.id!);
    messenger.showSnackBar(
      SnackBar(
        content: const Text('削除しました'),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: '元に戻す',
          onPressed: () => repo.save(expense), // IDを保持したまま再登録して復元
        ),
      ),
    );
  }

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorValue = category?.colorValue ?? 0xFF9E9E9E;
    final iconName = category?.iconName ?? 'more_horiz';
    final weekday = _weekdays[expense.date.weekday - 1]; // 曜日
    final dateStr = '${DateFormat('yyyy/MM/dd').format(expense.date)}($weekday)';
    // 項目名 → メモ → カテゴリ名 の優先順でタイトル表示
    final title = expense.itemName?.isNotEmpty == true
        ? expense.itemName!
        : (expense.memo?.isNotEmpty ?? false)
            ? expense.memo!
            : (category?.name ?? '不明');
    final categoryName = category?.name ?? '不明';

    final tile = ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: Color(colorValue),
        child: Icon(
          kCategoryIconMap[iconName] ?? Icons.category,
          color: Colors.white,
          size: 20,
        ),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text( // カテゴリ名（太字・カテゴリカラー）
            categoryName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: Color(colorValue),
            ),
          ),
          Text( // 項目名
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      subtitle: Text(dateStr, style: Theme.of(context).textTheme.bodySmall),
      isThreeLine: false,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            '¥${NumberFormat('#,##0').format(expense.amount)}',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          if (showDeleteButton) // Web版の支出一覧と同じクイック削除ボタン（ホームの最近の支出では非表示）
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18),
              color: Theme.of(context).colorScheme.outline,
              visualDensity: VisualDensity.compact,
              onPressed: () => _quickDelete(context, ref),
            ),
        ],
      ),
    );

    if (!showDeleteButton) return tile; // ホームの「最近の支出」はシンプルな行のまま

    // 支出一覧ではWeb版と同じく角丸カード＋左端のカテゴリカラー帯で囲む
    // ListTileのインク効果はMaterial祖先に直接描画されるため、背景色はContainerではなくMaterialに持たせる
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: colorScheme.surface,
        child: Row(
          children: [
            Container(width: 4, color: Color(colorValue)),
            Expanded(child: tile),
          ],
        ),
      ),
    );
  }
}
