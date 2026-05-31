import 'package:isar/isar.dart';

import '../../domain/entities/budget.dart';
import '../../domain/repositories/budget_repository.dart';
import '../models/budget_model.dart';

class BudgetRepositoryImpl implements BudgetRepository {
  final Isar _isar;
  const BudgetRepositoryImpl(this._isar);

  @override
  Future<Budget?> getByMonth(int year, int month) async {
    final model = await _isar.budgetModels
        .filter()
        .yearEqualTo(year)
        .monthEqualTo(month)
        .findFirst();
    return model?.toEntity();
  }

  @override
  Future<List<Budget>> getAll() async {
    final models = await _isar.budgetModels.where().findAll();
    return models.map((m) => m.toEntity()).toList();
  }

  @override
  Future<void> save(Budget budget) async {
    final existing = await _isar.budgetModels
        .filter()
        .yearEqualTo(budget.year)
        .monthEqualTo(budget.month)
        .findFirst();
    await _isar.writeTxn(() async {
      final model = BudgetModel.fromEntity(budget);
      if (existing != null) model.id = existing.id; // 同月の既存レコードを上書き
      await _isar.budgetModels.put(model);
    });
  }
}
