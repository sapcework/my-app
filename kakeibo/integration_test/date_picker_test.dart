// 実アプリで日本語カレンダーを開き、日曜・祝日が赤、土曜が青になり、祝日名が出て、
// 選んだ日が入力欄に入ることを確かめる。幅360dpでもはみ出さないことも確かめる。
// 画面写真を ui-compare/screenshots/app/date_picker*.png に保存する（目で見て確かめる用）。
//
// Run with: flutter test integration_test/date_picker_test.dart -d windows
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/presentation/providers/search_providers.dart';

const _outDir = r'D:\projects\my-app\ui-compare\screenshots\app';
const _captureScript = r'D:\projects\my-app\kakeibo\tool\capture_window.ps1';

Future<void> _capture(String name) async {
  final result = await Process.run('powershell', ['-NoProfile', '-File', _captureScript, '-ProcessName', 'kakeibo', '-OutPath', '$_outDir\\$name.png']);
  // ignore: avoid_print
  print(result.exitCode == 0 ? result.stdout : 'capture failed for $name: ${result.stderr}');
}

Future<ProviderContainer> _openStartDatePicker(WidgetTester tester) async {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
  await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち
  await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('検索')));
  await tester.pumpAndSettle();
  await tester.tap(find.ancestor(of: find.text('開始日'), matching: find.byType(InkWell)).first); // 欄そのものをタップする（文字は入力欄の飾りでタップを受けない）
  await tester.pumpAndSettle();
  expect(find.byType(Dialog), findsOneWidget);
  return container;
}

Future<void> _showSeptember2026(WidgetTester tester) async { // 祝日が3日続く 2026年9月まで「前の月」で移動する
  final now = DateTime.now();
  final back = (now.year - 2026) * 12 + now.month - 9;
  for (var i = 0; i < back; i++) {
    await tester.tap(find.byTooltip('前の月'));
    await tester.pumpAndSettle();
  }
  expect(find.text('2026年9月'), findsOneWidget);
}

Color? _dayColor(WidgetTester tester, int day) {
  final text = tester.widget<Text>(find.descendant(of: find.byType(Dialog), matching: find.text('$day')).first);
  return text.style?.color;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('日曜・祝日は赤、土曜は青で、選んだ日が入る', (tester) async {
    final container = await _openStartDatePicker(tester);
    for (final w in ['日', '月', '火', '水', '木', '金', '土']) {
      expect(find.descendant(of: find.byType(Dialog), matching: find.text(w)), findsOneWidget);
    }
    expect(find.text('キャンセル'), findsOneWidget); // 標準の部品も日本語
    await _showSeptember2026(tester);

    const red = Color(0xFFD32F2F), blue = Color(0xFF1565C0);
    expect(_dayColor(tester, 20), red, reason: '9/20 は日曜');
    expect(_dayColor(tester, 19), blue, reason: '9/19 は土曜');
    expect(_dayColor(tester, 18), isNot(anyOf(red, blue)), reason: '9/18 は平日');
    for (final d in [21, 22, 23]) {
      expect(_dayColor(tester, d), red, reason: '9/$d は祝日・休日');
    }
    expect(find.text('21日(月) 敬老の日'), findsOneWidget);
    expect(find.text('22日(火) 国民の休日'), findsOneWidget);
    expect(find.text('23日(水) 秋分の日'), findsOneWidget);

    await tester.tap(find.descendant(of: find.byType(Dialog), matching: find.text('22')).first);
    await tester.pumpAndSettle();
    expect(find.text('2026年9月22日(火)'), findsOneWidget);
    expect(find.text('国民の休日'), findsOneWidget); // 選んだ日の祝日名
    await _capture('date_picker');

    // 年・月の一覧から選ぶ
    await tester.tap(find.text('2026年9月'));
    await tester.pumpAndSettle();
    expect(find.text('2026年'), findsOneWidget);
    await _capture('date_picker_month');
    await tester.tap(find.text('5月'));
    await tester.pumpAndSettle();
    expect(find.text('2026年5月'), findsOneWidget);
    expect(find.text('6日(水) 振替休日'), findsOneWidget);

    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.byType(Dialog), findsNothing);
    expect(container.read(searchConditionProvider).from, DateTime(2026, 9, 22)); // 月を移しても選んだ日は変わらない
    expect(find.text('2026/09/22(火)'), findsOneWidget); // 1行で曜日付き
  });

  testWidgets('キャンセルでは入力欄が変わらない', (tester) async {
    final container = await _openStartDatePicker(tester);
    await _showSeptember2026(tester);
    await tester.tap(find.descendant(of: find.byType(Dialog), matching: find.text('22')).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('キャンセル'));
    await tester.pumpAndSettle();
    expect(container.read(searchConditionProvider).from, isNull);
  });

  testWidgets('幅360dpでもカレンダーがはみ出さない', (tester) async {
    final dpr = tester.view.devicePixelRatio;
    tester.view.physicalSize = Size(360 * dpr, 780 * dpr); // 小さめのスマホと同じ広さ
    addTearDown(tester.view.resetPhysicalSize);
    await _openStartDatePicker(tester); // はみ出すと RenderFlex overflow で失敗する
    expect(tester.getRect(find.byType(Dialog)).width, lessThanOrEqualTo(360));
    await tester.tap(find.byIcon(Icons.arrow_drop_down).last); // 年・月の一覧
    await tester.pumpAndSettle();
    expect(find.text('12月'), findsOneWidget);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android)); // タップ領域・密度を Android と同じにして測る
}
