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

    final now = DateTime.now();
    final defaults = [
      CategoryModel()
        ..name = '食費'
        ..colorValue = 0xFFFF9800 // Orange
        ..iconName = 'restaurant'
        ..sortOrder = 0
        ..createdAt = now,
      CategoryModel()
        ..name = '交通費'
        ..colorValue = 0xFF2196F3 // Blue
        ..iconName = 'directions_car'
        ..sortOrder = 1
        ..createdAt = now,
      CategoryModel()
        ..name = '日用品'
        ..colorValue = 0xFF4CAF50 // Green
        ..iconName = 'shopping_cart'
        ..sortOrder = 2
        ..createdAt = now,
      CategoryModel()
        ..name = '娯楽'
        ..colorValue = 0xFF9C27B0 // Purple
        ..iconName = 'sports_esports'
        ..sortOrder = 3
        ..createdAt = now,
      CategoryModel()
        ..name = '医療'
        ..colorValue = 0xFFF44336 // Red
        ..iconName = 'local_hospital'
        ..sortOrder = 4
        ..createdAt = now,
      CategoryModel()
        ..name = 'その他'
        ..colorValue = 0xFF9E9E9E // Grey
        ..iconName = 'more_horiz'
        ..sortOrder = 5
        ..createdAt = now,
    ];
    await _isar.writeTxn(() => _isar.categoryModels.putAll(defaults));
  }
}
