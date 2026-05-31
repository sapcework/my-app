import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';
import '../../../../../domain/entities/expense.dart';

class ExpenseListTile extends StatelessWidget {
  final Expense expense;
  final Category? category; // 削除済みカテゴリはnullになりうる
  final VoidCallback? onTap;

  const ExpenseListTile({
    super.key,
    required this.expense,
    this.category,
    this.onTap,
  });

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  @override
  Widget build(BuildContext context) {
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

    return ListTile(
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
      trailing: Text(
        '¥${NumberFormat('#,##0').format(expense.amount)}',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
