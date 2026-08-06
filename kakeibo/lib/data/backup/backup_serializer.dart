import '../../domain/entities/budget.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/expense.dart';
import '../models/recurring_expense_model.dart';
import 'category_icon_map.dart';

const kBackupVersion = '2'; // 書き出すバックアップの形式版数（Web版と共通。仕様: docs/backup-format-v2.md）

String _two(int v) => v.toString().padLeft(2, '0');

String _dateOnly(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

// このアプリの内部形式 → v2（Web版でもそのまま復元できる形式）
Map<String, dynamic> buildBackup({
  required List<Expense> expenses,
  required List<Category> categories,
  required List<Budget> budgets,
  // 定期支出だけはエンティティに無い lastRegisteredYear/Month も書き出すためモデルで受け取る
  // （これが欠けると復元後の初回起動で今月分が二重登録される）
  required List<RecurringExpenseModel> recurring,
}) {
  return {
    'version': kBackupVersion,
    'exportedAt': DateTime.now().toIso8601String(),
    'app': 'kakeibo-flutter',
    'categories': [
      for (var i = 0; i < categories.length; i++)
        {
          'id': '${categories[i].id ?? i + 1}',
          'name': categories[i].name,
          'color': hexFromColorValue(categories[i].colorValue),
          'icon': emojiFromIconName(categories[i].iconName), // Web版が読むフィールド
          'iconName': categories[i].iconName,
          'sortOrder': categories[i].sortOrder,
          'createdAt': categories[i].createdAt.toIso8601String(),
        },
    ],
    'expenses': [
      for (var i = 0; i < expenses.length; i++)
        {
          'id': '${expenses[i].id ?? i + 1}',
          'amount': expenses[i].amount,
          'categoryId': '${expenses[i].categoryId}',
          'itemName': expenses[i].itemName ?? '',
          'note': expenses[i].memo ?? '', // Web版のメモ欄は note
          'date': _dateOnly(expenses[i].date),
          'createdAt': expenses[i].createdAt.toIso8601String(),
        },
    ],
    'budgets': [
      for (final b in budgets)
        {
          'month': '${b.year}-${_two(b.month)}', // Web版は年月をひとつの文字列で持つ
          'amount': b.amount,
        },
    ],
    'recurring': [
      for (final r in recurring)
        {
          'id': '${r.id}',
          'name': r.name,
          'amount': r.amount,
          'categoryId': '${r.categoryId}',
          'dayOfMonth': r.dayOfMonth,
          'isActive': r.isActive,
          // 最後に自動登録した年月（Web版の lastGeneratedMonth と同じ意味）
          if (r.lastRegisteredYear > 0 && r.lastRegisteredMonth > 0)
            'lastGeneratedMonth': '${r.lastRegisteredYear}-${_two(r.lastRegisteredMonth)}',
        },
    ],
  };
}
