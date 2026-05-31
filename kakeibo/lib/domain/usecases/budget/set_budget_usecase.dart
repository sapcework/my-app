import '../../entities/budget.dart';
import '../../repositories/budget_repository.dart';

class SetBudgetUseCase {
  final BudgetRepository _repository;
  const SetBudgetUseCase(this._repository);

  Future<void> call({required int year, required int month, required double amount}) {
    return _repository.save(Budget(year: year, month: month, amount: amount));
  }
}
