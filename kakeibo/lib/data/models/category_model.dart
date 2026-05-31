import 'package:isar/isar.dart';

import '../../domain/entities/category.dart';

part 'category_model.g.dart';

@collection
class CategoryModel {
  Id id = Isar.autoIncrement;

  late String name;
  late int colorValue; // Color.value をintで保存
  late String iconName; // Material Iconsのフィールド名（例: 'restaurant'）

  @Index() // 表示順クエリ用インデックス
  late int sortOrder;

  late DateTime createdAt;

  static CategoryModel fromEntity(Category category) {
    final model = CategoryModel()
      ..name = category.name
      ..colorValue = category.colorValue
      ..iconName = category.iconName
      ..sortOrder = category.sortOrder
      ..createdAt = category.createdAt;
    if (category.id != null) model.id = category.id!;
    return model;
  }

  Category toEntity() => Category(
        id: id,
        name: name,
        colorValue: colorValue,
        iconName: iconName,
        sortOrder: sortOrder,
        createdAt: createdAt,
      );
}
