import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/lock.dart';
import 'state/notes.dart';
import 'state/settings.dart';
import 'ui/lock_screen.dart';
import 'ui/note_edit_screen.dart';
import 'ui/note_list_screen.dart';

final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>(); // 画面を閉じた後でも「元に戻す」を出せるように
final navigatorKey = GlobalKey<NavigatorState>(); // 通知のタップからメモを開くため
final openNoteRequest = ValueNotifier<String?>(null); // 開いてほしいメモの ID（リマインダー通知から）

const _secureChannel = MethodChannel('fastnote/secure');

ThemeData buildTheme(Color appColor, Brightness brightness) { // 高速メモ帳と同じく、上のバーを「アプリの色」で塗る
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: appColor, brightness: brightness);
  final bar = dark ? Color.alphaBlend(appColor.withValues(alpha: 0.25), scheme.surfaceContainer) : appColor;
  return ThemeData(
    colorScheme: scheme,
    appBarTheme: AppBarTheme(backgroundColor: bar, foregroundColor: Colors.white, iconTheme: const IconThemeData(color: Colors.white)),
    floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: appColor, foregroundColor: Colors.white, shape: const CircleBorder()),
  );
}

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
    openNoteRequest.addListener(_openRequested);
    WidgetsBinding.instance.addPostFrameCallback((_) => _openRequested()); // 起動前に届いていた分
  }

  @override
  void dispose() {
    openNoteRequest.removeListener(_openRequested);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _openRequested() {
    final id = openNoteRequest.value;
    final nav = navigatorKey.currentState;
    if (id == null || nav == null) return;
    openNoteRequest.value = null;
    final n = ref.read(notesProvider).byId(id);
    if (n == null || n.inTrash) return;
    nav.popUntil((r) => r.isFirst);
    nav.push(MaterialPageRoute(builder: (_) => NoteEditScreen(noteId: id))); // ロック中ならロック画面の下で開き、解除すると見える
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
    final settings = ref.watch(settingsProvider);
    _applySecure(lock.enabled && lock.hideInRecents);
    if (lock.locked) FocusManager.instance.primaryFocus?.unfocus(); // 下の画面のキーボードを閉じる

    return MaterialApp(
      title: 'FastNote',
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: scaffoldMessengerKey,
      theme: buildTheme(settings.appColor, Brightness.light),
      darkTheme: buildTheme(settings.appColor, Brightness.dark),
      themeMode: settings.themeMode,
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
