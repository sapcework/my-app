import '../../entities/recurring_expense.dart';
import '../../repositories/recurring_expense_repository.dart';

class AddRecurringExpenseUseCase {
  final RecurringExpenseRepository _repository;
  const AddRecurringExpenseUseCase(this._repository);

  Future<void> call({
    required String name,
    required double amount,
    required int categoryId,
    required int dayOfMonth,
  }) {
    return _repository.save(RecurringExpense(
      name: name,
      amount: amount,
      categoryId: categoryId,
      dayOfMonth: dayOfMonth,
    ));
  }
}
