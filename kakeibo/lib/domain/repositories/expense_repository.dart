import '../entities/expense.dart';

abstract interface class ExpenseRepository {
  Stream<List<Expense>> watchAll(); // 全件をリアルタイム監視
  Stream<List<Expense>> watchByMonth(int year, int month); // 月次フィルタで監視
  Future<Expense?> findById(int id); // 1件取得
  Future<void> save(Expense expense); // 追加・更新（idの有無で分岐）
  Future<void> delete(int id); // 削除
  Future<List<String>> getUniqueItemNames(); // 過去に入力した項目名の一覧（重複除去・昇順）
  Future<List<DateTime>> getAvailableMonths(); // 支出が存在する年月一覧（降順）
}
