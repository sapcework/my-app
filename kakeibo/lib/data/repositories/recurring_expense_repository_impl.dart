import 'package:isar/isar.dart';

import '../../domain/entities/recurring_expense.dart';
import '../../domain/repositories/recurring_expense_repository.dart';
import '../models/expense_model.dart';
import '../models/recurring_expense_model.dart';

class RecurringExpenseRepositoryImpl implements RecurringExpenseRepository {
  final Isar _isar;
  const RecurringExpenseRepositoryImpl(this._isar);

  @override
  Stream<List<RecurringExpense>> watchAll() {
    return _isar.recurringExpenseModels
        .where()
        .watch(fireImmediately: true)
        .map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Future<void> save(RecurringExpense r) async {
    await _isar.writeTxn(() async {
      if (r.id != null) {
        final existing = await _isar.recurringExpenseModels.get(r.id!);
        if (existing != null) {
          // 更新時はlastRegistered値を引き継ぐ
          existing
            ..name = r.name
            ..amount = r.amount
            ..categoryId = r.categoryId
            ..dayOfMonth = r.dayOfMonth
            ..isActive = r.isActive;
          await _isar.recurringExpenseModels.put(existing);
          return;
        }
      }
      await _isar.recurringExpenseModels.put(RecurringExpenseModel.fromEntity(r));
    });
  }

  @override
  Future<void> delete(int id) async {
    await _isar.writeTxn(() => _isar.recurringExpenseModels.delete(id));
  }

  @override
  Future<void> autoRegisterForCurrentMonth() async {
    final now = DateTime.now();
    final actives = await _isar.recurringExpenseModels
        .filter()
        .isActiveEqualTo(true)
        .findAll();

    for (final model in actives) {
      if (model.lastRegisteredYear == now.year && model.lastRegisteredMonth == now.month) {
        continue; // 今月分は登録済み
      }

      // 月の日数を超えないようにdayOfMonthをclamp（例: 2月31日 → 28日）
      final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
      final day = model.dayOfMonth.clamp(1, daysInMonth);
      final date = DateTime(now.year, now.month, day);

      await _isar.writeTxn(() async {
        final expense = ExpenseModel()
          ..amount = model.amount
          ..categoryId = model.categoryId
          ..memo = model.name
          ..date = date
          ..createdAt = now;
        await _isar.expenseModels.put(expense);

        model.lastRegisteredYear = now.year;
        model.lastRegisteredMonth = now.month;
        await _isar.recurringExpenseModels.put(model);
      });
    }
  }
}
