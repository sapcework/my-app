import '../../entities/budget.dart';
import '../../repositories/budget_repository.dart';

class GetBudgetUseCase {
  final BudgetRepository _repository;
  const GetBudgetUseCase(this._repository);

  Future<Budget?> call(int year, int month) {
    return _repository.getByMonth(year, month);
  }
}
