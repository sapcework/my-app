import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';

import '../../data/models/budget_model.dart';
import '../../data/models/category_model.dart';
import '../../data/models/expense_model.dart';
import '../../data/models/recurring_expense_model.dart';

final isarProvider = FutureProvider<Isar>((ref) async {
  final dir = await getApplicationDocumentsDirectory();
  final isar = await Isar.open(
    [ExpenseModelSchema, CategoryModelSchema, BudgetModelSchema, RecurringExpenseModelSchema],
    directory: dir.path,
    name: 'kakeibo',
  );
  ref.onDispose(isar.close); // Providerが破棄される時にDB接続を閉じる
  return isar;
});
