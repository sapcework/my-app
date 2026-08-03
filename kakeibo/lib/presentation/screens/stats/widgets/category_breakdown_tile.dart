import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';

// Web版のカテゴリ別カードに対応：角丸カード＋色付きアイコン枠＋シェブロン
class CategoryBreakdownTile extends StatelessWidget {
  final Category? category; // 削除済みカテゴリはnull
  final double amount;
  final double percentage;
  final VoidCallback? onTap;

  const CategoryBreakdownTile({
    super.key,
    required this.category,
    required this.amount,
    required this.percentage,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = Color(category?.colorValue ?? 0xFF9E9E9E);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
            ),
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
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      Text(
                        '${percentage.toStringAsFixed(1)}%',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
                Text(
                  '¥${NumberFormat('#,##0').format(amount)}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                Icon(Icons.chevron_right, size: 18, color: colorScheme.outlineVariant),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
