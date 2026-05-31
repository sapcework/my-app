import '../../entities/expense.dart';
import '../../repositories/expense_repository.dart';

class GetMonthlyExpensesUseCase {
  final ExpenseRepository _repository;
  const GetMonthlyExpensesUseCase(this._repository);

  Stream<List<Expense>> call(int year, int month) =>
      _repository.watchByMonth(year, month);
}
