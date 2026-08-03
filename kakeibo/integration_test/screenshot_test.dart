// Navigates through the app's main screens and captures a real on-screen PNG of each
// (via tool/capture_window.ps1) so they can be compared side by side with the
// equivalent kakeiboWeb screenshots in ui-compare/screenshots/web/.
//
// Run with: flutter test integration_test/screenshot_test.dart -d windows
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kakeibo/app.dart';

const _outDir = r'D:\projects\my-app\ui-compare\screenshots\app';
const _captureScript = r'D:\projects\my-app\kakeibo\tool\capture_window.ps1';

Future<void> _capture(String name) async {
  final result = await Process.run('powershell', [
    '-NoProfile',
    '-File', _captureScript,
    '-ProcessName', 'kakeibo',
    '-OutPath', '$_outDir\\$name.png',
  ]);
  // ignore: avoid_print
  print(result.exitCode == 0 ? result.stdout : 'capture failed for $name: ${result.stderr}');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('capture main screens', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));
    await tester.pumpAndSettle(const Duration(seconds: 2)); // Isar初期化・シード投入待ち

    await _capture('home');

    await tester.tap(find.text('支出'));
    await tester.pumpAndSettle();
    await _capture('expenses');

    await tester.tap(find.text('表'));
    await tester.pumpAndSettle();
    await _capture('table');

    await tester.tap(find.text('統計'));
    await tester.pumpAndSettle();
    await _capture('stats');

    await tester.tap(find.text('設定'));
    await tester.pumpAndSettle();
    await _capture('settings');

    // 設定 → カテゴリ
    await tester.tap(find.text('カテゴリ'));
    await tester.pumpAndSettle();
    await _capture('categories');
    await tester.pageBack();
    await tester.pumpAndSettle();

    // 設定 → 予算設定
    await tester.tap(find.text('予算設定'));
    await tester.pumpAndSettle();
    await _capture('budget');
    await tester.pageBack();
    await tester.pumpAndSettle();

    // 設定 → 定期支出
    await tester.tap(find.text('定期支出'));
    await tester.pumpAndSettle();
    await _capture('recurring');
    await tester.pageBack();
    await tester.pumpAndSettle();
  });
}
