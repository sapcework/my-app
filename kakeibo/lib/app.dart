import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/constants/app_strings.dart';
import 'core/theme/app_theme.dart';
import 'presentation/providers/app_init_provider.dart';
import 'presentation/providers/passcode_provider.dart';
import 'presentation/router/app_router.dart';
import 'presentation/screens/lock/passcode_lock_screen.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // appInitProvider が Isar初期化 + seedDefaults を直列で処理する
    // 完了後にルーターを描画することで repository_providers の .requireValue が安全に使える
    final initAsync = ref.watch(appInitProvider);

    return initAsync.when(
      loading: () => const MaterialApp(
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      ),
      error: (e, _) => MaterialApp(
        home: Scaffold(body: Center(child: Text('初期化エラー: $e'))),
      ),
      data: (_) {
        final passcode = ref.watch(passcodeControllerProvider);
        if (passcode.enabled && !passcode.unlocked) { // パスコード設定時は解錠までロック画面を表示
          return MaterialApp(
            title: AppStrings.appName,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: ThemeMode.system,
            home: const PasscodeLockScreen(),
            debugShowCheckedModeBanner: false,
          );
        }
        final router = ref.watch(appRouterProvider);
        return MaterialApp.router(
          title: AppStrings.appName,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeMode.system,
          routerConfig: router,
          debugShowCheckedModeBanner: false,
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
