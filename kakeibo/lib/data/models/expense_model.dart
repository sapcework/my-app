import 'package:isar/isar.dart';

import '../../domain/entities/expense.dart';

part 'expense_model.g.dart';

@collection
class ExpenseModel {
  Id id = Isar.autoIncrement; // Isarが自動採番。保存前はautoIncrementのまま

  late double amount;

  @Index() // カテゴリ別集計クエリ用インデックス
  late int categoryId;

  String? itemName; // 項目名（任意）
  String? memo;

  @Index() // 月次範囲クエリ用インデックス（watchByMonth）
  late DateTime date;

  late DateTime createdAt;

  // Entity → Model 変換（Data層内のみで使用）
  static ExpenseModel fromEntity(Expense expense) {
    final model = ExpenseModel()
      ..amount = expense.amount
      ..categoryId = expense.categoryId
      ..itemName = expense.itemName
      ..memo = expense.memo
      ..date = expense.date
      ..createdAt = expense.createdAt;
    if (expense.id != null) model.id = expense.id!;
    return model;
  }

  // Model → Entity 変換
  Expense toEntity() => Expense(
        id: id,
        amount: amount,
        categoryId: categoryId,
        itemName: itemName,
        memo: memo,
        date: date,
        createdAt: createdAt,
      );
}
