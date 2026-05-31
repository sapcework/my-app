import '../../entities/recurring_expense.dart';
import '../../repositories/recurring_expense_repository.dart';

class UpdateRecurringExpenseUseCase {
  final RecurringExpenseRepository _repository;
  const UpdateRecurringExpenseUseCase(this._repository);

  Future<void> call(RecurringExpense r) => _repository.save(r);
}
