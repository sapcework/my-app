import 'package:isar/isar.dart';

import '../../domain/entities/category.dart';
import '../../domain/repositories/category_repository.dart';
import '../models/category_model.dart';

class CategoryRepositoryImpl implements CategoryRepository {
  final Isar _isar;
  const CategoryRepositoryImpl(this._isar);

  @override
  Stream<List<Category>> watchAll() {
    return _isar.categoryModels
        .where()
        .watch(fireImmediately: true)
        .map((models) {
      models.sort((a, b) => a.sortOrder.compareTo(b.sortOrder)); // sortOrder昇順
      return models.map((m) => m.toEntity()).toList();
    });
  }

  @override
  Future<Category?> findById(int id) async {
    final model = await _isar.categoryModels.get(id);
    return model?.toEntity();
  }

  @override
  Future<void> save(Category category) async {
    await _isar.writeTxn(
      () => _isar.categoryModels.put(CategoryModel.fromEntity(category)),
    );
  }

  @override
  Future<void> delete(int id) async {
    await _isar.writeTxn(() => _isar.categoryModels.delete(id));
  }

  @override
  Future<void> seedDefaults() async {
    final count = await _isar.categoryModels.count();
    if (count > 0) return; // 既存カテゴリがあれば初期投入をスキップ

    // Web版 DEFAULT_CATEGORIES（16件）に対応する初期カテゴリ
    const seeds = [
      ('食費', 0xFFFF9800, 'restaurant'),
      ('外食', 0xFFFF5722, 'ramen_dining'),
      ('住居', 0xFF009688, 'home'),
      ('光熱費', 0xFFFFC107, 'lightbulb'),
      ('通信費', 0xFF03A9F4, 'smartphone'),
      ('交通費', 0xFF2196F3, 'directions_car'),
      ('日用品', 0xFF4CAF50, 'shopping_cart'),
      ('衣服・美容', 0xFFE91E63, 'checkroom'),
      ('医療', 0xFFF44336, 'local_hospital'),
      ('保険', 0xFF607D8B, 'shield'),
      ('教育', 0xFF3F51B5, 'menu_book'),
      ('サブスク', 0xFF9C27B0, 'credit_card'),
      ('娯楽', 0xFF8BC34A, 'sports_esports'),
      ('旅行', 0xFF00BCD4, 'flight'),
      ('貯蓄・投資', 0xFF795548, 'savings'),
      ('その他', 0xFF9E9E9E, 'inventory_2'),
    ];
    final now = DateTime.now();
    final defaults = [
      for (var i = 0; i < seeds.length; i++)
        CategoryModel()
          ..name = seeds[i].$1
          ..colorValue = seeds[i].$2
          ..iconName = seeds[i].$3
          ..sortOrder = i
          ..createdAt = now,
    ];
    await _isar.writeTxn(() => _isar.categoryModels.putAll(defaults));
  }
}
