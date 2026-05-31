import '../../entities/recurring_expense.dart';
import '../../repositories/recurring_expense_repository.dart';

class GetRecurringExpensesUseCase {
  final RecurringExpenseRepository _repository;
  const GetRecurringExpensesUseCase(this._repository);

  Stream<List<RecurringExpense>> call() => _repository.watchAll();
}
