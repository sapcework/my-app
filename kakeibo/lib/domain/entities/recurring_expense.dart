import 'package:freezed_annotation/freezed_annotation.dart';

part 'recurring_expense.freezed.dart';

@freezed
class RecurringExpense with _$RecurringExpense {
  const factory RecurringExpense({
    int? id,
    required String name, // 支出名（メモとして自動入力される）
    required double amount,
    required int categoryId,
    required int dayOfMonth, // 毎月何日（1-31）
    @Default(true) bool isActive,
  }) = _RecurringExpense;
}
