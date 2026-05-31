import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/recurring_expense.dart';
import '../../domain/usecases/recurring/add_recurring_expense_usecase.dart';
import '../../domain/usecases/recurring/delete_recurring_expense_usecase.dart';
import '../../domain/usecases/recurring/get_recurring_expenses_usecase.dart';
import '../../domain/usecases/recurring/update_recurring_expense_usecase.dart';
import 'repository_providers.dart';

final getRecurringExpensesUseCaseProvider = Provider<GetRecurringExpensesUseCase>(
  (ref) => GetRecurringExpensesUseCase(ref.watch(recurringExpenseRepositoryProvider)),
);

final addRecurringExpenseUseCaseProvider = Provider<AddRecurringExpenseUseCase>(
  (ref) => AddRecurringExpenseUseCase(ref.watch(recurringExpenseRepositoryProvider)),
);

final updateRecurringExpenseUseCaseProvider = Provider<UpdateRecurringExpenseUseCase>(
  (ref) => UpdateRecurringExpenseUseCase(ref.watch(recurringExpenseRepositoryProvider)),
);

final deleteRecurringExpenseUseCaseProvider = Provider<DeleteRecurringExpenseUseCase>(
  (ref) => DeleteRecurringExpenseUseCase(ref.watch(recurringExpenseRepositoryProvider)),
);

// 全定期支出をリアルタイム監視
final recurringExpensesProvider = StreamProvider<List<RecurringExpense>>((ref) {
  return ref.watch(getRecurringExpensesUseCaseProvider).call();
});
