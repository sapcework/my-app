import '../../repositories/expense_repository.dart';

class DeleteExpenseUseCase {
  final ExpenseRepository _repository;
  const DeleteExpenseUseCase(this._repository);

  Future<void> call(int id) => _repository.delete(id);
}
