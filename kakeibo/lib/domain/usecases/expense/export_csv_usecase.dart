import 'dart:convert';
import 'dart:io';

import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../entities/category.dart';
import '../../entities/expense.dart';
import '../../repositories/category_repository.dart';
import '../../repositories/expense_repository.dart';

/// 支出明細CSV（ヘッダー＋日付昇順の明細行）を組み立てる。
/// 全明細CSVと統計の選択月CSVで同じ形式にする（Web版の expenseDetailRows と同じ列構成）。
String buildExpenseDetailCsv(List<Expense> expenses, List<Category> categories) {
  final catMap = {for (final c in categories) if (c.id != null) c.id!: c};
  final sorted = [...expenses]..sort((a, b) => a.date.compareTo(b.date));

  final buf = StringBuffer();
  buf.writeln('日付,カテゴリ,項目名,メモ,金額,登録日時');
  final dateFmt = DateFormat('yyyy/MM/dd');
  final tsFmt = DateFormat('yyyyMMddHHmmss');
  for (final e in sorted) {
    buf.writeln([
      dateFmt.format(e.date),
      escapeCsvCell(catMap[e.categoryId]?.name ?? '不明'),
      escapeCsvCell(e.itemName ?? ''),
      escapeCsvCell(e.memo ?? ''),
      e.amount.toStringAsFixed(0),
      tsFmt.format(e.createdAt),
    ].join(','));
  }
  return buf.toString();
}

/// BOM付きUTF-8でExcelが文字化けしないように、Documents直下へ書き出してパスを返す
Future<String> writeCsvToDocuments(String fileName, String csv) async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File('${dir.path}${Platform.pathSeparator}$fileName'); // Windowsで「\」と「/」が混ざらないようにする
  await file.writeAsBytes([0xEF, 0xBB, 0xBF, ...utf8.encode(csv)]);
  return file.path;
}

String escapeCsvCell(String value) { // CSVの1セル分。全明細・月別支出表の両方で使う
  var v = value;
  if (v.isNotEmpty && '=+-@\t\r'.contains(v[0])) {
    v = "'$v"; // Excel で開いたときに数式として実行されないようにする（CSVインジェクション対策。OWASP の推奨）
  }
  if (v.contains(',') || v.contains('"') || v.contains('\n') || v.contains('\r')) {
    return '"${v.replaceAll('"', '""')}"';
  }
  return v;
}

class ExportCsvUseCase {
  final ExpenseRepository _expenseRepo;
  final CategoryRepository _categoryRepo;
  const ExportCsvUseCase(this._expenseRepo, this._categoryRepo);

  Future<String> call(int year, int month) async {
    final expenses = await _expenseRepo.watchByMonth(year, month).first;
    final categories = await _categoryRepo.watchAll().first;
    final fileName = 'kakeibo_${year}_${month.toString().padLeft(2, '0')}.csv';
    return writeCsvToDocuments(fileName, buildExpenseDetailCsv(expenses, categories));
  }
}
