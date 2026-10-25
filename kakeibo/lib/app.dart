import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/constants/app_strings.dart';
import 'core/theme/app_theme.dart';
import 'presentation/providers/app_init_provider.dart';
import 'presentation/providers/isar_provider.dart';
import 'presentation/providers/passcode_provider.dart';
import 'presentation/router/app_router.dart';
import 'presentation/screens/lock/passcode_lock_screen.dart';
import 'presentation/screens/startup_error_screen.dart';

const _locale = Locale('ja', 'JP'); // 標準の部品（ダイアログ・コピー貼り付けのメニュー・ライセンス画面など）を日本語で表示する
const _localizationsDelegates = [
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // appInitProvider が Isar初期化 + seedDefaults を直列で処理する
    // 完了後にルーターを描画することで repository_providers の .requireValue が安全に使える
    final initAsync = ref.watch(appInitProvider);

    MaterialApp plain(Widget home) => MaterialApp( // ルーターを作る前（読み込み中・起動失敗・起動時のロック）の画面
          title: AppStrings.appName,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeMode.system,
          home: home,
          debugShowCheckedModeBanner: false,
          locale: _locale,
          supportedLocales: const [_locale],
          localizationsDelegates: _localizationsDelegates,
        );

    return initAsync.when(
      loading: () => plain(const Scaffold(body: Center(child: CircularProgressIndicator()))),
      error: (e, st) {
        debugPrint('起動に失敗しました: $e\n$st'); // 詳しい原因は開発用のログにだけ出す
        return plain(StartupErrorScreen(
          onRetry: () {
            ref.invalidate(isarProvider);
            ref.invalidate(appInitProvider);
          },
        ));
      },
      data: (_) {
        final passcode = ref.watch(passcodeControllerProvider);
        if (passcode.enabled && !passcode.unlocked && !passcode.unlockedOnce) { // 起動直後は解錠までロック画面だけを表示
          return plain(const PasscodeLockScreen());
        }
        final router = ref.watch(appRouterProvider);
        ref.watch(lockRouteSyncProvider); // 使っている途中の再ロックは画面の上に重ねる
        return MaterialApp.router(
          title: AppStrings.appName,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeMode.system,
          routerConfig: router,
          debugShowCheckedModeBanner: false,
          locale: _locale,
          supportedLocales: const [_locale],
          localizationsDelegates: _localizationsDelegates,
          // Web版はモバイルファースト（max-w-lg=512px）で、広いウィンドウでは中央寄せになる。
          // デスクトップの広いウィンドウでも同じ見た目になるよう、全画面をこの幅に制限して中央寄せにする。
          builder: (context, child) {
            return ColoredBox(
              color: Theme.of(context).colorScheme.surfaceContainerLowest,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 512),
                  child: child,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
