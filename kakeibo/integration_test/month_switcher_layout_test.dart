// 年月の切り替えをタイトルと同じ行に置いても、幅360dpの小さめのスマホで
// はみ出さず・タイトルが切れず・月を切り替えられることを実アプリで確かめる。
//
// Run with: flutter test integration_test/month_switcher_layout_test.dart -d windows
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/intl.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/presentation/providers/expense_providers.dart';
import 'package:kakeibo/presentation/router/app_router.dart';
import 'package:kakeibo/presentation/widgets/month_switcher_bar.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('幅360dpでも年月の切り替えがタイトルの横に収まる', (tester) async {
    final dpr = tester.view.devicePixelRatio;
    tester.view.physicalSize = Size(360 * dpr, 780 * dpr); // 小さめのスマホと同じ広さ
    addTearDown(tester.view.resetPhysicalSize);

    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
    await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち

    Future<void> check(String title) async {
      final bar = find.byType(MonthSwitcherBar);
      expect(bar, findsOneWidget, reason: '$title に年月の切り替えが無い');
      final appBar = find.ancestor(of: bar, matching: find.byType(AppBar));
      expect(find.descendant(of: appBar, matching: find.text(title)), findsOneWidget, reason: '$title が年月と同じ行に無い');

      final titleText = find.descendant(of: appBar, matching: find.text(title)); // 下のタブにも同じ文字があるので AppBar の中に絞る
      final titleBox = tester.renderObject<RenderParagraph>(titleText);
      expect(titleBox.didExceedMaxLines, isFalse, reason: '$title のタイトルが「…」で切れている');
      final barRect = tester.getRect(bar);
      expect(barRect.right, lessThanOrEqualTo(360), reason: '$title で年月が画面の右からはみ出している');
      expect(tester.getRect(titleText).right, lessThanOrEqualTo(barRect.left), reason: '$title でタイトルと年月が重なっている');

      // 前の月 → 次の月で元に戻る
      final before = container.read(selectedMonthProvider);
      await tester.tap(find.descendant(of: bar, matching: find.byIcon(Icons.chevron_left)));
      await tester.pumpAndSettle();
      final prev = DateTime(before.year, before.month - 1);
      expect(container.read(selectedMonthProvider), prev);
      expect(find.descendant(of: bar, matching: find.text(DateFormat('yyyy年M月').format(prev))), findsOneWidget);
      await tester.tap(find.descendant(of: bar, matching: find.byIcon(Icons.chevron_right)));
      await tester.pumpAndSettle();
      expect(container.read(selectedMonthProvider), before);
    }

    await check('家計簿'); // ホーム
    for (final (tab, title) in [('支出', '支出一覧'), ('統計', '統計')]) {
      await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(tab)));
      await tester.pumpAndSettle();
      await check(title);
    }

    container.read(appRouterProvider).push('/budget'); // 戻る矢印が付くので一番幅が厳しい画面
    await tester.pumpAndSettle();
    await check('予算設定');
  }, variant: TargetPlatformVariant.only(TargetPlatform.android)); // タップ領域・密度を Android と同じにして測る
}
