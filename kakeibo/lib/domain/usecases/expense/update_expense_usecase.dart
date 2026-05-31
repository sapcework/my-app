import '../../entities/expense.dart';
import '../../repositories/expense_repository.dart';

class UpdateExpenseUseCase {
  final ExpenseRepository _repository;
  const UpdateExpenseUseCase(this._repository);

  Future<void> call(Expense expense) => _repository.save(expense); // idがnon-nullなら更新
}
