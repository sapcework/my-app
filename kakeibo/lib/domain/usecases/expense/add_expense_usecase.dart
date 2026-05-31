import '../../entities/expense.dart';
import '../../repositories/expense_repository.dart';

class AddExpenseUseCase {
  final ExpenseRepository _repository;
  const AddExpenseUseCase(this._repository);

  Future<void> call({
    required double amount,
    required int categoryId,
    String? itemName,
    String? memo,
    required DateTime date,
  }) =>
      _repository.save(
        Expense(
          amount: amount,
          categoryId: categoryId,
          itemName: itemName,
          memo: memo,
          date: date,
          createdAt: DateTime.now(),
        ),
      );
}
