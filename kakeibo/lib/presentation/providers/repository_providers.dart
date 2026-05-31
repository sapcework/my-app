import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/budget_repository_impl.dart';
import '../../data/repositories/category_repository_impl.dart';
import '../../data/repositories/expense_repository_impl.dart';
import '../../data/repositories/recurring_expense_repository_impl.dart';
import '../../domain/repositories/budget_repository.dart';
import '../../domain/repositories/category_repository.dart';
import '../../domain/repositories/expense_repository.dart';
import '../../domain/repositories/recurring_expense_repository.dart';
import 'isar_provider.dart';

final expenseRepositoryProvider = Provider<ExpenseRepository>((ref) {
  final isar = ref.watch(isarProvider).requireValue;
  return ExpenseRepositoryImpl(isar);
});

final categoryRepositoryProvider = Provider<CategoryRepository>((ref) {
  final isar = ref.watch(isarProvider).requireValue;
  return CategoryRepositoryImpl(isar);
});

final budgetRepositoryProvider = Provider<BudgetRepository>((ref) {
  final isar = ref.watch(isarProvider).requireValue;
  return BudgetRepositoryImpl(isar);
});

final recurringExpenseRepositoryProvider = Provider<RecurringExpenseRepository>((ref) {
  final isar = ref.watch(isarProvider).requireValue;
  return RecurringExpenseRepositoryImpl(isar);
});
