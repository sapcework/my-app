import 'package:isar/isar.dart';

import '../../domain/entities/budget.dart';

part 'budget_model.g.dart';

@collection
class BudgetModel {
  Id id = Isar.autoIncrement;
  late int year;
  late int month;
  late double amount;

  static BudgetModel fromEntity(Budget e) => BudgetModel()
    ..id = e.id ?? Isar.autoIncrement
    ..year = e.year
    ..month = e.month
    ..amount = e.amount;

  Budget toEntity() => Budget(id: id, year: year, month: month, amount: amount);
}
