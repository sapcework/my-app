import 'package:freezed_annotation/freezed_annotation.dart';

part 'expense.freezed.dart';

@freezed
class Expense with _$Expense {
  const factory Expense({
    int? id, // Isarが採番するID。新規作成時はnull
    required double amount, // 金額
    required int categoryId, // カテゴリID（外部キー相当）
    String? itemName, // 項目名（任意）
    String? memo, // メモ（任意）
    required DateTime date, // 支出日
    required DateTime createdAt, // レコード作成日時
  }) = _Expense;
}
