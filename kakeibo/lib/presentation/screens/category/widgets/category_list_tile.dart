import 'package:flutter/material.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';

// Web版のカテゴリカード（角丸カード＋カラー名＋編集/削除アイコン）に対応
class CategoryListTile extends StatelessWidget {
  final Category category;
  final VoidCallback onDelete;
  final VoidCallback? onTap;

  const CategoryListTile({
    super.key,
    required this.category,
    required this.onDelete,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = Color(category.colorValue);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: colorScheme.surface,
        child: InkWell(
          onTap: onTap,
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
                    kCategoryIconMap[category.iconName] ?? Icons.category, // 未知のアイコン名はデフォルト表示
                    color: color,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    category.name,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  color: colorScheme.onSurfaceVariant,
                  visualDensity: VisualDensity.compact,
                  onPressed: onTap,
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18),
                  color: colorScheme.error,
                  visualDensity: VisualDensity.compact,
                  onPressed: onDelete,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
