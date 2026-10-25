// 実アプリを起動して Android の戻るボタン（WidgetsBinding.handlePopRoute）を押し、
// タブではホームに戻り、ホームでだけアプリが終了することを確かめる。
//
// Run with: flutter test integration_test/back_navigation_test.dart -d windows
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/intl.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/presentation/providers/expense_providers.dart';
import 'package:kakeibo/presentation/screens/settings/about_screen.dart';

int _selectedTab(WidgetTester tester) => tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

Future<void> _pressBack(WidgetTester tester) async {
  await tester.binding.handlePopRoute(); // Android の戻るボタンと同じ経路
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('戻るボタンでタブからホームへ戻り、ホームでだけ終了する', (tester) async {
    var exitRequests = 0;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.pop') exitRequests++; // アプリを閉じる要求
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
    await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち
    expect(_selectedTab(tester), 0);

    // 各タブで戻る → ホームに戻り、終了はしない
    for (final (label, index) in [('支出', 1), ('表', 2), ('検索', 3), ('統計', 4), ('設定', 5)]) {
      await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
      await tester.pumpAndSettle();
      expect(_selectedTab(tester), index);
      await _pressBack(tester);
      expect(_selectedTab(tester), 0, reason: '$label で戻ったのにホームに戻っていない');
      expect(exitRequests, 0, reason: '$label で戻ったらアプリが終了した');
    }

    // 支出タブで選んだ年月は、戻ったホームでもそのまま（全画面で共通）
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('支出')));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.chevron_left)); // 前の月へ
    await tester.pumpAndSettle();
    final picked = container.read(selectedMonthProvider);
    await _pressBack(tester);
    expect(_selectedTab(tester), 0);
    expect(container.read(selectedMonthProvider), picked);
    expect(find.text(DateFormat('yyyy年M月').format(picked)), findsOneWidget, reason: 'ホームの年月が支出タブで選んだ月と違う');

    // 設定 → 家計簿について → 戻るで設定へ、もう一度でホームへ
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('設定')));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('家計簿について'), 200, scrollable: find.byType(Scrollable).first);
    await tester.ensureVisible(find.text('家計簿について')); // 下端だとナビゲーションバーに隠れるので画面内に出す
    await tester.pumpAndSettle();
    await tester.tap(find.text('家計簿について'));
    await tester.pumpAndSettle();
    expect(find.byType(AboutScreen), findsOneWidget);
    await _pressBack(tester);
    expect(find.byType(AboutScreen), findsNothing);
    expect(_selectedTab(tester), 5, reason: '「家計簿について」から戻ったら設定に戻るはず');
    await _pressBack(tester);
    expect(_selectedTab(tester), 0);
    expect(exitRequests, 0);

    // ホームで戻る → 終了
    await _pressBack(tester);
    expect(exitRequests, 1, reason: 'ホームで戻ったのにアプリが終了しない');
  });
}
