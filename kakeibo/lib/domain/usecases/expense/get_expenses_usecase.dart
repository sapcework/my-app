import '../../entities/expense.dart';
import '../../repositories/expense_repository.dart';

class GetExpensesUseCase {
  final ExpenseRepository _repository;
  const GetExpensesUseCase(this._repository);

  Stream<List<Expense>> call() => _repository.watchAll();
}
