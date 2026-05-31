import '../entities/recurring_expense.dart';

abstract interface class RecurringExpenseRepository {
  Stream<List<RecurringExpense>> watchAll();
  Future<void> save(RecurringExpense r);
  Future<void> delete(int id);
  Future<void> autoRegisterForCurrentMonth(); // 起動時に今月分の定期支出を自動登録
}
