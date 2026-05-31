import 'package:freezed_annotation/freezed_annotation.dart';

part 'budget.freezed.dart';

@freezed
class Budget with _$Budget {
  const factory Budget({
    int? id,
    required int year,
    required int month,
    required double amount, // 月次予算金額
  }) = _Budget;
}
