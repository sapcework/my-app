import '../entities/category.dart';

abstract interface class CategoryRepository {
  Stream<List<Category>> watchAll(); // 全件をリアルタイム監視
  Future<Category?> findById(int id); // 1件取得
  Future<void> save(Category category); // 追加・更新
  Future<void> delete(int id); // 削除
  Future<void> seedDefaults(); // 初回起動時のデフォルトカテゴリ投入
}
