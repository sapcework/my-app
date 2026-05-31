import 'dart:convert';
import 'dart:io';

import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../repositories/category_repository.dart';
import '../../repositories/expense_repository.dart';

class ExportCsvUseCase {
  final ExpenseRepository _expenseRepo;
  final CategoryRepository _categoryRepo;
  const ExportCsvUseCase(this._expenseRepo, this._categoryRepo);

  Future<String> call(int year, int month) async {
    final expenses = await _expenseRepo.watchByMonth(year, month).first;
    final categories = await _categoryRepo.watchAll().first;
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};

    final buffer = StringBuffer();
    buffer.writeln('日付,金額,カテゴリ,メモ');
    final fmt = DateFormat('yyyy/MM/dd');
    for (final e in expenses) {
      final date = fmt.format(e.date);
      final category = _escapeCsv(categoryMap[e.categoryId]?.name ?? '');
      final memo = _escapeCsv(e.memo ?? '');
      buffer.writeln('$date,${e.amount.toStringAsFixed(0)},$category,$memo');
    }

    final dir = await getApplicationDocumentsDirectory();
    final fileName = 'kakeibo_${year}_${month.toString().padLeft(2, '0')}.csv';
    final file = File('${dir.path}/$fileName');
    // BOM付きUTF-8でExcelが文字化けしないように書き出す
    await file.writeAsBytes([0xEF, 0xBB, 0xBF, ...utf8.encode(buffer.toString())]);
    return file.path;
  }

  String _escapeCsv(String value) {
    if (value.contains(',') || value.contains('"') || value.contains('\n')) {
      return '"${value.replaceAll('"', '""')}"';
    }
    return value;
  }
}
