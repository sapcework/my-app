import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/budget.dart';
import '../../domain/usecases/budget/get_budget_usecase.dart';
import '../../domain/usecases/budget/set_budget_usecase.dart';
import 'expense_providers.dart';
import 'repository_providers.dart';

final setBudgetUseCaseProvider = Provider<SetBudgetUseCase>(
  (ref) => SetBudgetUseCase(ref.watch(budgetRepositoryProvider)),
);

final getBudgetUseCaseProvider = Provider<GetBudgetUseCase>(
  (ref) => GetBudgetUseCase(ref.watch(budgetRepositoryProvider)),
);

// ホーム・支出一覧・統計画面用：選択月の予算
final selectedMonthBudgetProvider = FutureProvider<Budget?>((ref) {
  final month = ref.watch(selectedMonthProvider);
  return ref.watch(getBudgetUseCaseProvider).call(month.year, month.month);
});
