import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';

class CategoryBreakdownTile extends StatelessWidget {
  final Category? category; // 削除済みカテゴリはnull
  final double amount;
  final double percentage;

  const CategoryBreakdownTile({
    super.key,
    required this.category,
    required this.amount,
    required this.percentage,
  });

  @override
  Widget build(BuildContext context) {
    final colorValue = category?.colorValue ?? 0xFF9E9E9E;

    return ListTile(
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: Color(colorValue),
        child: Icon(
          kCategoryIconMap[category?.iconName ?? 'more_horiz'] ?? Icons.category,
          color: Colors.white,
          size: 16,
        ),
      ),
      title: Text(category?.name ?? '不明'),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '¥${NumberFormat('#,##0').format(amount)}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          Text(
            '${percentage.toStringAsFixed(1)}%',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
