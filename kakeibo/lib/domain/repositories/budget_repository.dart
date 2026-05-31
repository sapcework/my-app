import '../entities/budget.dart';

abstract interface class BudgetRepository {
  Future<Budget?> getByMonth(int year, int month);
  Future<List<Budget>> getAll(); // バックアップ用
  Future<void> save(Budget budget);
}
