import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/expense.dart';
import '../../domain/usecases/expense/search_expenses.dart';
import 'repository_providers.dart';

final searchConditionProvider = StateProvider<SearchCondition>((ref) => const SearchCondition()); // 検索タブの条件。全体で1つ持つのでタブを移っても残る

final searchResultsProvider = StreamProvider<List<Expense>>((ref) { // 全期間の支出に条件をかけた結果。結果画面で編集・削除するとその場で反映される
  final condition = ref.watch(searchConditionProvider);
  return ref.watch(expenseRepositoryProvider).watchAll().map((all) => searchExpenses(all, condition));
});
