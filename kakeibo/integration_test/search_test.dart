// 実アプリで検索タブに条件を入れて「検索する」を押し、結果の件数・並び順が
// DBの全支出に searchExpenses をかけたものと一致するか、戻ると条件が残るかを確かめる。
// あわせて幅360dpでも6つのタブと検索画面がはみ出さないことを確かめる。
//
// Run with: flutter test integration_test/search_test.dart -d windows
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/intl.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/domain/usecases/expense/search_expenses.dart';
import 'package:kakeibo/presentation/providers/repository_providers.dart';
import 'package:kakeibo/presentation/providers/search_providers.dart';
import 'package:kakeibo/presentation/screens/expense/widgets/expense_list_tile.dart';
import 'package:kakeibo/presentation/screens/search/search_result_screen.dart';
import 'package:kakeibo/presentation/screens/search/search_screen.dart';

Future<void> _pressBack(WidgetTester tester) async {
  await tester.binding.handlePopRoute(); // Android の戻るボタンと同じ経路
  await tester.pumpAndSettle();
}

Future<ProviderContainer> _start(WidgetTester tester) async {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
  await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち
  await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('検索')));
  await tester.pumpAndSettle();
  expect(find.byType(SearchScreen), findsOneWidget);
  return container;
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('画面から入れた条件で、DBと同じ結果・並び順になる', (tester) async {
    final container = await _start(tester);
    final all = await container.read(expenseRepositoryProvider).watchAll().first;
    expect(all, isNotEmpty, reason: '支出データが無いと確認できない');

    // 最低額＝金額の中央値・項目名に最初の項目名を「含まない」・金額の低い順
    final amounts = [for (final e in all) e.amount]..sort();
    final minAmount = amounts[amounts.length ~/ 2].floor();
    final excludedItem = all.firstWhere((e) => (e.itemName ?? '').isNotEmpty, orElse: () => all.first).itemName ?? '';

    await tester.enterText(find.widgetWithText(TextField, '最低額'), '$minAmount');
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('メモ'), 200, scrollable: find.byType(Scrollable).first); // 日付・金額が縦並びになり項目名は画面の下にあるので、その下の「メモ」まで出す
    final itemField = find.widgetWithText(TextField, 'キーワード（スペースで区切って複数）').first; // 1つ目が項目名、2つ目がメモ
    await tester.enterText(itemField, excludedItem);
    await tester.pumpAndSettle();
    await _tapVisible(tester, find.widgetWithText(ChoiceChip, '含まない').first);
    await _tapVisible(tester, find.text(SearchSort.dateDesc.label));
    await tester.tap(find.text(SearchSort.amountAsc.label).last); // 開いたメニューの中の項目
    await tester.pumpAndSettle();

    final condition = container.read(searchConditionProvider);
    expect(condition.minAmount, minAmount.toDouble());
    expect(condition.itemKeyword, excludedItem);
    expect(condition.itemMode, KeywordMode.exclude);
    expect(condition.sort, SearchSort.amountAsc);
    final expected = searchExpenses(all, condition);
    // ignore: avoid_print
    print('全${all.length}件 → 条件「¥$minAmount以上・項目名「$excludedItem」を含まない・金額の低い順」で${expected.length}件');

    await tester.tap(find.text('検索する'));
    await tester.pumpAndSettle();
    expect(find.byType(SearchResultScreen), findsOneWidget);
    final total = expected.fold<double>(0, (s, e) => s + e.amount);
    expect(find.text('${expected.length}件'), findsOneWidget);
    expect(find.text('合計 ¥${NumberFormat('#,##0').format(total)}'), findsOneWidget);
    if (expected.isEmpty) {
      expect(find.text('条件に合う支出はありません'), findsOneWidget);
    } else {
      final shown = [for (final t in tester.widgetList<ExpenseListTile>(find.byType(ExpenseListTile))) t.expense.id]; // 画面に作られた分だけ
      expect(shown, [for (final e in expected.take(shown.length)) e.id], reason: '並び順がDBの結果と違う');
    }

    // 戻ると条件が残っている
    await _pressBack(tester);
    expect(find.byType(SearchScreen), findsOneWidget);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 2000)); // 順序を選ぶため下へスクロールしたので、金額欄が見える先頭まで戻す
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, '$minAmount'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('メモ'), 200, scrollable: find.byType(Scrollable).first); // 項目名の欄は画面の下にある
    expect(find.widgetWithText(TextField, excludedItem), findsWidgets);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 2000)); // 先頭に戻す
    await tester.pumpAndSettle();

    // 別のタブへ移って戻っても残っている
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('ホーム')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('検索')));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, '$minAmount'), findsOneWidget);

    // 条件をクリアで初期状態（分類は全選択）に戻る
    await tester.tap(find.text('条件をクリア'));
    await tester.pumpAndSettle();
    final cleared = container.read(searchConditionProvider);
    expect(cleared.minAmount, isNull);
    expect(cleared.itemKeyword, '');
    expect(cleared.excludedCategoryIds, isEmpty);
    expect(cleared.sort, SearchSort.dateDesc);
    expect(find.widgetWithText(TextField, '$minAmount'), findsNothing);
  });

  testWidgets('矛盾した条件では「検索する」を押せず理由が出る', (tester) async {
    final container = await _start(tester);
    await tester.enterText(find.widgetWithText(TextField, '最低額'), '500');
    await tester.enterText(find.widgetWithText(TextField, '最高額'), '100');
    await tester.pumpAndSettle();
    expect(find.text('最低額が最高額より大きくなっています'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.ancestor(of: find.text('検索する'), matching: find.byWidgetPredicate((w) => w is FilledButton))).onPressed, isNull);

    await tester.tap(find.text('条件をクリア'));
    await tester.pumpAndSettle();
    await _tapVisible(tester, find.text('すべて解除'));
    expect(find.text('分類が1つも選ばれていません'), findsOneWidget);
    await _tapVisible(tester, find.text('すべて選択'));
    expect(find.text('分類が1つも選ばれていません'), findsNothing);
    expect(container.read(searchConditionProvider).excludedCategoryIds, isEmpty);
  });

  testWidgets('幅360dpでも6つのタブと検索画面がはみ出さない', (tester) async {
    final dpr = tester.view.devicePixelRatio;
    tester.view.physicalSize = Size(360 * dpr, 780 * dpr); // 小さめのスマホと同じ広さ
    addTearDown(tester.view.resetPhysicalSize);
    await _start(tester); // はみ出すと RenderFlex overflow でここで失敗する

    for (final label in ['ホーム', '支出', '表', '検索', '統計', '設定']) {
      final rect = tester.getRect(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
      expect(rect.left, greaterThanOrEqualTo(0), reason: '$label が左にはみ出している');
      expect(rect.right, lessThanOrEqualTo(360), reason: '$label が右にはみ出している');
    }
    await tester.scrollUntilVisible(find.text('順序'), 200, scrollable: find.byType(Scrollable).first); // 下までスクロールしても崩れない
    await tester.pumpAndSettle();
    await tester.tap(find.text('検索する'));
    await tester.pumpAndSettle();
    expect(find.byType(SearchResultScreen), findsOneWidget);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android)); // タップ領域・密度を Android と同じにして測る
}
