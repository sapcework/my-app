import 'package:flutter/material.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../domain/entities/category.dart';

class CategoryListTile extends StatelessWidget {
  final Category category;
  final VoidCallback onDelete;

  const CategoryListTile({
    super.key,
    required this.category,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: Color(category.colorValue),
        child: Icon(
          kCategoryIconMap[category.iconName] ?? Icons.category, // 未知のアイコン名はデフォルト表示
          color: Colors.white,
          size: 20,
        ),
      ),
      title: Text(category.name),
      trailing: IconButton(
        icon: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.error),
        onPressed: onDelete,
      ),
    );
  }
}
