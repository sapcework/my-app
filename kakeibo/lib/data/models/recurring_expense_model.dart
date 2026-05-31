import 'package:isar/isar.dart';

import '../../domain/entities/recurring_expense.dart';

part 'recurring_expense_model.g.dart';

@collection
class RecurringExpenseModel {
  Id id = Isar.autoIncrement;
  late String name;
  late double amount;
  late int categoryId;
  late int dayOfMonth;
  late bool isActive;
  int lastRegisteredYear = 0; // 0: 未登録
  int lastRegisteredMonth = 0; // 0: 未登録

  static RecurringExpenseModel fromEntity(RecurringExpense e) => RecurringExpenseModel()
    ..id = e.id ?? Isar.autoIncrement
    ..name = e.name
    ..amount = e.amount
    ..categoryId = e.categoryId
    ..dayOfMonth = e.dayOfMonth
    ..isActive = e.isActive;

  RecurringExpense toEntity() => RecurringExpense(
        id: id,
        name: name,
        amount: amount,
        categoryId: categoryId,
        dayOfMonth: dayOfMonth,
        isActive: isActive,
      );
}
