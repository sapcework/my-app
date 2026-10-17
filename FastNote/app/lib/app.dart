import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/lock.dart';
import 'ui/lock_screen.dart';
import 'ui/note_list_screen.dart';

final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>(); // 画面を閉じた後でも「元に戻す」を出せるように

const _secureChannel = MethodChannel('fastnote/secure');

class FastNoteApp extends ConsumerStatefulWidget {
  const FastNoteApp({super.key});

  @override
  ConsumerState<FastNoteApp> createState() => _FastNoteAppState();
}

class _FastNoteAppState extends ConsumerState<FastNoteApp> with WidgetsBindingObserver {
  bool? _secure; // 直近に設定した FLAG_SECURE

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final lock = ref.read(lockProvider);
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) lock.onPaused();
    if (state == AppLifecycleState.resumed) lock.onResumed();
  }

  @override
  Future<bool> didPopRoute() async => ref.read(lockProvider).locked; // ロック中は戻るボタンで下の画面を操作させない

  void _applySecure(bool secure) { // ロック中の内容を履歴画面のサムネイルに出さない
    if (_secure == secure || !Platform.isAndroid) return;
    _secure = secure;
    _secureChannel.invokeMethod('setSecure', secure).catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(lockProvider);
    _applySecure(lock.enabled && lock.hideInRecents);
    if (lock.locked) FocusManager.instance.primaryFocus?.unfocus(); // 下の画面のキーボードを閉じる

    return MaterialApp(
      title: 'FastNote',
      scaffoldMessengerKey: scaffoldMessengerKey,
      theme: ThemeData(colorSchemeSeed: Colors.teal, brightness: Brightness.light),
      darkTheme: ThemeData(colorSchemeSeed: Colors.teal, brightness: Brightness.dark),
      locale: const Locale('ja'),
      supportedLocales: const [Locale('ja')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const NoteListScreen(),
      builder: (context, child) => Stack(
        children: [
          Offstage(offstage: lock.locked, child: child), // 状態は保ったまま描かない
          if (lock.locked) const Positioned.fill(child: LockGate()),
        ],
      ),
    );
  }
}
