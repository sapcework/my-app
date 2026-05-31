import '../../repositories/recurring_expense_repository.dart';

class DeleteRecurringExpenseUseCase {
  final RecurringExpenseRepository _repository;
  const DeleteRecurringExpenseUseCase(this._repository);

  Future<void> call(int id) => _repository.delete(id);
}
