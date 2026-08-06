import 'package:isar/isar.dart';

import '../../domain/entities/expense.dart';
import '../../domain/repositories/expense_repository.dart';
import '../models/expense_model.dart';

class ExpenseRepositoryImpl implements ExpenseRepository {
  final Isar _isar;
  const ExpenseRepositoryImpl(this._isar);

  @override
  Stream<List<Expense>> watchAll() {
    return _isar.expenseModels
        .where()
        .watch(fireImmediately: true)
        .map((models) {
      models.sort((a, b) => b.date.compareTo(a.date)); // 新しい支出順に並び替え
      return models.map((m) => m.toEntity()).toList();
    });
  }

  @override
  Stream<List<Expense>> watchByMonth(int year, int month) {
    final start = DateTime(year, month);
    final end = DateTime(year, month + 1); // Dartは月オーバーフローを自動処理（12月→翌年1月）
    return _isar.expenseModels
        .filter()
        .dateGreaterThan(start, include: true)
        .dateLessThan(end)
        .watch(fireImmediately: true)
        .map((models) {
      models.sort((a, b) => b.date.compareTo(a.date));
      return models.map((m) => m.toEntity()).toList();
    });
  }

  @override
  Future<Expense?> findById(int id) async {
    final model = await _isar.expenseModels.get(id);
    return model?.toEntity();
  }

  @override
  Future<void> save(Expense expense) async {
    await _isar.writeTxn(
      () => _isar.expenseModels.put(ExpenseModel.fromEntity(expense)),
    );
  }

  @override
  Future<void> delete(int id) async {
    await _isar.writeTxn(() => _isar.expenseModels.delete(id));
  }

  @override
  Future<List<String>> getUniqueItemNames({int? categoryId}) async {
    final all = await _isar.expenseModels.where().findAll();

    final counts = <String, int>{};
    final firstSeen = <String, int>{}; // 同数のときの並びを安定させる
    for (final m in all) {
      if (categoryId != null && m.categoryId != categoryId) continue; // カテゴリ別の履歴にする
      final name = m.itemName?.trim();
      if (name == null || name.isEmpty) continue;
      counts[name] = (counts[name] ?? 0) + 1;
      firstSeen.putIfAbsent(name, () => firstSeen.length);
    }

    return counts.keys.toList()
      ..sort((a, b) {
        final byCount = counts[b]!.compareTo(counts[a]!); // 使用回数の多い順（Web版と同じ）
        return byCount != 0 ? byCount : firstSeen[a]!.compareTo(firstSeen[b]!);
      });
  }

  @override
  Future<List<DateTime>> getAvailableMonths() async {
    final all = await _isar.expenseModels.where().findAll();
    final months = all
        .map((m) => DateTime(m.date.year, m.date.month))
        .toSet()
        .toList()
      ..sort((a, b) => b.compareTo(a)); // 降順（新しい月が先頭）
    return months;
  }
}
