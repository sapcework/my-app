// 実アプリを起動して3種類のCSV出力（全明細・月別支出表・統計の選択月）を画面から実行し、
// 書き出されたファイルの中身がDBのデータと一致するかを確かめる。
//
// Run with: flutter test integration_test/csv_export_test.dart -d windows
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/intl.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/domain/entities/expense.dart';
import 'package:kakeibo/presentation/providers/expense_providers.dart';
import 'package:kakeibo/presentation/providers/repository_providers.dart';
import 'package:path_provider/path_provider.dart';

const _bom = [0xEF, 0xBB, 0xBF];

/// 引用符・カンマ・改行を含むセルにも対応した最小限のCSVパーサ
List<List<String>> _parseCsv(String text) {
  final rows = <List<String>>[];
  var row = <String>[];
  final cell = StringBuffer();
  var quoted = false;
  for (var i = 0; i < text.length; i++) {
    final ch = text[i];
    if (quoted) {
      if (ch == '"' && i + 1 < text.length && text[i + 1] == '"') {
        cell.write('"'); // エスケープされた引用符
        i++;
      } else if (ch == '"') {
        quoted = false;
      } else {
        cell.write(ch);
      }
    } else if (ch == '"') {
      quoted = true;
    } else if (ch == ',') {
      row.add(cell.toString());
      cell.clear();
    } else if (ch == '\n') {
      row.add(cell.toString().replaceAll('\r', ''));
      cell.clear();
      rows.add(row);
      row = <String>[];
    } else {
      cell.write(ch);
    }
  }
  if (cell.isNotEmpty || row.isNotEmpty) rows.add([...row, cell.toString()]); // 末尾に改行が無い場合
  return rows;
}

/// BOMの有無を確かめてから本文を返す
Future<String> _readCsv(String path) async {
  final bytes = await File(path).readAsBytes();
  expect(bytes.take(3).toList(), _bom, reason: '$path の先頭にBOMが無い');
  return utf8.decode(bytes.sublist(3));
}

/// 出力完了のSnackBarに表示されたパスを取り出す
String _snackBarPath(WidgetTester tester) {
  final finder = find.descendant(of: find.byType(SnackBar), matching: find.byType(Text));
  expect(finder, findsOneWidget, reason: '出力完了のSnackBarが出ていない');
  final text = tester.widget<Text>(finder).data!;
  // ignore: avoid_print
  print('SnackBar: $text');
  expect(text, startsWith('出力完了: '));
  final path = text.substring('出力完了: '.length);
  expect(path.contains('/'), isFalse, reason: 'パスの区切りに「/」が混ざっている'); // Windowsでは「\」だけになるはず
  return path;
}

Future<void> _dismissSnackBar(WidgetTester tester) async {
  ScaffoldMessenger.of(tester.element(find.byType(SnackBar))).removeCurrentSnackBar();
  await tester.pumpAndSettle();
}

/// 設定画面の項目までスクロールしてタップし、確認ダイアログで「書き出す」を押す
Future<void> _runSettingsExport(WidgetTester tester, String title, String expectedFileName) async {
  await tester.scrollUntilVisible(find.text(title), 200, scrollable: find.byType(Scrollable).first);
  await tester.tap(find.text(title));
  await tester.pumpAndSettle();
  expect(find.textContaining(expectedFileName), findsOneWidget, reason: '確認ダイアログにファイル名が出ていない');
  await tester.tap(find.text('書き出す'));
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('CSV出力3種の中身がDBと一致する', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
    await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち

    final expenses = await container.read(expenseRepositoryProvider).watchAll().first;
    final categories = await container.read(categoryRepositoryProvider).watchAll().first;
    final catName = {for (final c in categories) if (c.id != null) c.id!: c.name};
    expect(expenses, isNotEmpty, reason: '支出データが無いと確認できない');
    final docs = (await getApplicationDocumentsDirectory()).path;
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    String monthKey(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}';
    // ignore: avoid_print
    print('DB: 支出${expenses.length}件 / カテゴリ${categories.length}件 / 出力先 $docs');

    // 明細CSV（全明細・統計の選択月で共通の形式）を1行ずつDBと照合する
    void expectDetailRows(List<List<String>> rows, List<Expense> source, String label) {
      expect(rows.first, ['日付', 'カテゴリ', '項目名', 'メモ', '金額', '登録日時'], reason: '$label のヘッダーが違う');
      final body = rows.skip(1).toList();
      expect(body.length, source.length, reason: '$label の行数が支出件数と違う');
      final sorted = [...source]..sort((a, b) => a.date.compareTo(b.date));
      final dateFmt = DateFormat('yyyy/MM/dd');
      final tsFmt = DateFormat('yyyyMMddHHmmss');
      for (var i = 0; i < sorted.length; i++) {
        final e = sorted[i];
        expect(body[i], [
          dateFmt.format(e.date),
          catName[e.categoryId] ?? '不明',
          e.itemName ?? '',
          e.memo ?? '',
          e.amount.toStringAsFixed(0),
          tsFmt.format(e.createdAt),
        ], reason: '$label の${i + 1}件目の内容が違う');
      }
    }

    await tester.tap(find.text('設定'));
    await tester.pumpAndSettle();

    // ---- 1. 全明細CSV ----
    final allName = 'kakeibo_all_$today.csv';
    await _runSettingsExport(tester, '全明細CSV出力', allName);
    final allPath = _snackBarPath(tester);
    expect(File(allPath).uri.pathSegments.last, allName);
    expectDetailRows(_parseCsv(await _readCsv(allPath)), expenses, '全明細');
    await _dismissSnackBar(tester);

    // ---- 2. 月別支出表CSV ----
    final monthlyName = 'kakeibo_monthly_$today.csv';
    await _runSettingsExport(tester, '月別支出表CSV出力', monthlyName);
    final monthlyPath = _snackBarPath(tester);
    expect(File(monthlyPath).uri.pathSegments.last, monthlyName);
    final monthlyRows = _parseCsv(await _readCsv(monthlyPath));
    final header = monthlyRows.first;
    expect(header.first, '年月');
    expect(header.last, '合計');
    final months = expenses.map((e) => monthKey(e.date)).toSet().toList()..sort();
    expect(monthlyRows.skip(1).map((r) => r.first).toList(), months, reason: '年月の行が違う');
    for (final row in monthlyRows.skip(1)) {
      final mes = expenses.where((e) => monthKey(e.date) == row.first);
      expect(row.length, header.length, reason: '${row.first} の列数がヘッダーと違う');
      for (var c = 1; c < header.length - 1; c++) {
        final sum = mes.where((e) => catName[e.categoryId] == header[c]).fold<double>(0, (s, e) => s + e.amount);
        expect(row[c], sum.toStringAsFixed(0), reason: '${row.first} の ${header[c]} が違う');
      }
      expect(row.last, mes.fold<double>(0, (s, e) => s + e.amount).toStringAsFixed(0), reason: '${row.first} の合計が違う');
    }
    final colSum = header.sublist(1, header.length - 1).length;
    expect(colSum, expenses.map((e) => e.categoryId).toSet().length, reason: '使われたカテゴリ数と列数が違う');
    await _dismissSnackBar(tester);

    // ---- 3. 統計画面の選択月CSV（データのある最新月で確認） ----
    final latest = expenses.map((e) => e.date).reduce((a, b) => a.isAfter(b) ? a : b);
    container.read(selectedMonthProvider.notifier).state = DateTime(latest.year, latest.month);
    await tester.tap(find.text('統計'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('CSV出力'));
    await tester.pumpAndSettle();
    final statsPath = _snackBarPath(tester);
    expect(File(statsPath).uri.pathSegments.last,
        'kakeibo_${latest.year}_${latest.month.toString().padLeft(2, '0')}.csv');
    final monthExpenses = expenses.where((e) => monthKey(e.date) == monthKey(latest)).toList();
    expectDetailRows(_parseCsv(await _readCsv(statsPath)), monthExpenses, '統計の選択月');
    await _dismissSnackBar(tester);
  });
}
