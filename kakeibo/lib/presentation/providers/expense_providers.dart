import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/expense.dart';
import '../../domain/usecases/expense/add_expense_usecase.dart';
import '../../domain/usecases/expense/delete_expense_usecase.dart';
import '../../domain/usecases/expense/export_csv_usecase.dart';
import '../../domain/usecases/expense/get_monthly_expenses_usecase.dart';
import '../../domain/usecases/expense/update_expense_usecase.dart';
import 'repository_providers.dart';

final addExpenseUseCaseProvider = Provider<AddExpenseUseCase>((ref) {
  return AddExpenseUseCase(ref.watch(expenseRepositoryProvider));
});

final updateExpenseUseCaseProvider = Provider<UpdateExpenseUseCase>((ref) {
  return UpdateExpenseUseCase(ref.watch(expenseRepositoryProvider));
});

final deleteExpenseUseCaseProvider = Provider<DeleteExpenseUseCase>((ref) {
  return DeleteExpenseUseCase(ref.watch(expenseRepositoryProvider));
});

final getMonthlyExpensesUseCaseProvider = Provider<GetMonthlyExpensesUseCase>((ref) {
  return GetMonthlyExpensesUseCase(ref.watch(expenseRepositoryProvider));
});

// 支出一覧画面の選択月（初期値：今月の1日）
final selectedMonthProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month);
});

// 支出一覧画面用：選択月の支出をリアルタイム監視
final selectedMonthExpensesProvider = StreamProvider<List<Expense>>((ref) {
  final month = ref.watch(selectedMonthProvider);
  return ref.watch(getMonthlyExpensesUseCaseProvider).call(month.year, month.month);
});

// ホーム画面用：選択月の前月の支出（サマリーカードの前月比表示用。Web版と同じく選択中の月を基準にする）
final previousMonthExpensesProvider = StreamProvider<List<Expense>>((ref) {
  final month = ref.watch(selectedMonthProvider);
  final prev = DateTime(month.year, month.month - 1); // Dartは月アンダーフローを自動処理（1月→前年12月）
  return ref.watch(getMonthlyExpensesUseCaseProvider).call(prev.year, prev.month);
});

// 検索キーワードフィルター
final expenseSearchQueryProvider = StateProvider<String>((ref) => '');

// カテゴリフィルター（nullは全件）
final expenseCategoryFilterProvider = StateProvider<int?>((ref) => null);

// CSVエクスポートUseCaseProvider
final exportCsvUseCaseProvider = Provider((ref) {
  final expenseRepo = ref.watch(expenseRepositoryProvider);
  final categoryRepo = ref.watch(categoryRepositoryProvider);
  return ExportCsvUseCase(expenseRepo, categoryRepo);
});
