// 実アプリで、パスコード設定中に「裏に回して1分以上たって戻る」と再ロックされ、
// 入力途中のフォームが残ったままロック画面が重なること、戻るボタンではロックを外せないことを確かめる。
// 時刻は差し替えた時計で進める。終わったらパスコードは解除する（開発PCの設定を汚さない）。
//
// Run with: flutter test integration_test/relock_test.dart -d windows
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kakeibo/app.dart';
import 'package:kakeibo/presentation/providers/passcode_provider.dart';
import 'package:kakeibo/presentation/router/app_router.dart';
import 'package:kakeibo/presentation/screens/expense/expense_form_screen.dart';
import 'package:kakeibo/presentation/screens/lock/passcode_lock_screen.dart';

Future<void> _enterPin(WidgetTester tester, String pin) async {
  for (final d in pin.split('')) {
    await tester.tap(find.descendant(of: find.byType(PasscodeLockScreen), matching: find.text(d)));
    await tester.pump();
  }
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('裏に回して1分たつと再ロックし、解錠すると入力途中の画面に戻る', (tester) async {
    var now = DateTime(2026, 10, 25, 12);
    final controller = PasscodeController(hasher: (pin, salt) async => '$salt:$pin', now: () => now);
    final container = ProviderContainer(overrides: [passcodeControllerProvider.overrideWith((ref) => controller)]);
    addTearDown(container.dispose);
    addTearDown(controller.removePasscode); // 失敗しても開発PCにパスコードを残さない

    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const App()));
    await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち
    await controller.setPasscode('1234'); // 設定した本人はそのまま使い続けられる
    await tester.pumpAndSettle();
    expect(find.byType(PasscodeLockScreen), findsNothing);

    container.read(appRouterProvider).push('/expenses/add');
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '項目名（任意）'), '入力途中');
    await tester.pumpAndSettle();

    // 59秒では再ロックしない
    controller.onHidden();
    now = now.add(const Duration(seconds: 59));
    controller.onShown();
    await tester.pumpAndSettle();
    expect(find.byType(PasscodeLockScreen), findsNothing);

    // 1分以上で再ロック。下の画面は残っている
    controller.onHidden();
    now = now.add(const Duration(minutes: 1));
    controller.onShown();
    await tester.pumpAndSettle();
    expect(find.byType(PasscodeLockScreen), findsOneWidget);

    // 戻るボタンではロックを外せない
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(PasscodeLockScreen), findsOneWidget);

    // 間違ったPINでは開かない
    await _enterPin(tester, '0000');
    expect(find.byType(PasscodeLockScreen), findsOneWidget);
    expect(find.textContaining('パスコードが違います'), findsOneWidget);

    // 正しいPINで解錠すると、入力途中のフォームに戻る
    await _enterPin(tester, '1234');
    expect(find.byType(PasscodeLockScreen), findsNothing);
    expect(find.byType(ExpenseFormScreen), findsOneWidget);
    expect(find.text('入力途中'), findsOneWidget, reason: '再ロックで入力内容が消えてはいけない');
  });
}
