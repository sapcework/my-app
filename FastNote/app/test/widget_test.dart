import 'dart:io';

import 'package:fastnote/app.dart';
import 'package:fastnote/data/note.dart';
import 'package:fastnote/data/note_db.dart';
import 'package:fastnote/state/json_file.dart';
import 'package:fastnote/state/lock.dart';
import 'package:fastnote/state/notes.dart';
import 'package:fastnote/state/settings.dart';
import 'package:fastnote/ui/about_screen.dart';
import 'package:fastnote/ui/lock_screen.dart';
import 'package:fastnote/ui/settings_screen.dart';
import 'package:fastnote/ui/text_layout_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';

// 画面の流れのテスト。ファイルや DB への実 I/O はフェイク時計の下では完了しないためメモリ上の代用品を使う

class MemoryNoteDb implements NoteDb {
  final rows = <String, Note>{};
  final folderRows = <String, Folder>{};
  @override
  Future<List<Note>> all() async => rows.values.toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  @override
  Future<void> upsert(Note n) async => rows[n.id] = n;
  @override
  Future<void> delete(String id) async => rows.remove(id);
  @override
  Future<void> deleteMany(Iterable<String> ids) async => ids.forEach(rows.remove);
  @override
  Future<void> insertAll(List<Note> notes, {List<Folder> folders = const []}) async {
    rows.addAll({for (final n in notes) n.id: n});
    folderRows.addAll({for (final f in folders) f.id: f});
  }

  @override
  Future<List<Folder>> folders() async => folderRows.values.toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  @override
  Future<void> upsertFolder(Folder f) async => folderRows[f.id] = f;
  @override
  Future<void> deleteFolder(String id) async {
    folderRows.remove(id);
    rows.updateAll((_, n) => n.folderId == id ? n.copyWith(folderId: () => null) : n);
  }

  @override
  Future<void> close() async {}
}

class MemoryJsonFile implements JsonFile {
  Map<String, dynamic> data = {};
  @override
  File get file => File('memory.json');
  @override
  Future<Map<String, dynamic>> read() async => Map.of(data);
  @override
  Future<void> write(Map<String, dynamic> d) async => data = Map.of(d);
}

class NoBiometric implements BiometricAuth {
  @override
  Future<bool> available() async => false;
  @override
  Future<bool> authenticate() async => false;
}

Finder _scrollableIn(Finder screen) => find.descendant(of: screen, matching: find.byType(Scrollable)).first; // 画面が重なっているとき、どの画面をスクロールするか

Future<String> fastHash(String secret, String salt) async => '$salt:$secret';

void main() {
  late MemoryNoteDb db;
  late NotesController notes;
  late SettingsController settings;
  late LockController lock;

  Future<void> start(WidgetTester tester, {List<String> bodies = const []}) async {
    db = MemoryNoteDb();
    for (final (i, b) in bodies.indexed) {
      db.rows['id$i'] = Note(id: 'id$i', body: b, sortOrder: i, createdAt: i, updatedAt: 1000000 + i); // 後ろほど新しい
    }
    notes = NotesController(db);
    settings = SettingsController(MemoryJsonFile());
    lock = LockController(MemoryJsonFile(), biometric: NoBiometric(), hash: fastHash);
    await notes.load();
    await settings.load();
    await lock.load();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        notesProvider.overrideWith((ref) => notes),
        settingsProvider.overrideWith((ref) => settings),
        lockProvider.overrideWith((ref) => lock),
      ],
      child: const FastNoteApp(),
    ));
    await tester.pumpAndSettle();
  }

  Future<void> back(WidgetTester tester) async {
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
  }

  Future<void> openDrawer(WidgetTester tester) async {
    await tester.tap(find.byTooltip('ナビゲーション メニューを開く'));
    await tester.pumpAndSettle();
  }

  Future<void> editorMenu(WidgetTester tester, String item) async {
    await tester.tap(find.byTooltip('メニュー'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(item));
    await tester.pumpAndSettle();
  }

  List<String> listedTitles(WidgetTester tester) => [
        for (final e in tester.widgetList<Text>(find.descendant(of: find.byType(ListView), matching: find.byType(Text))))
          if (e.style?.fontSize == settings.listFontSize) e.data!,
      ];

  testWidgets('新しいメモを書いて戻ると一覧の先頭に出て、「保存されました」と出る', (tester) async {
    await start(tester, bodies: ['前からあるメモ']);
    expect(find.text('私のノート'), findsOneWidget);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '買い物\n牛乳');
    await tester.pump(const Duration(seconds: 1)); // 自動保存を待つ
    expect(db.rows.values.where((n) => n.body == '買い物\n牛乳'), hasLength(1), reason: '戻る前に保存されている');
    await back(tester);
    expect(find.text('保存されました'), findsOneWidget);
    expect(listedTitles(tester), ['買い物', '前からあるメモ']);
  });

  testWidgets('何も書かずに戻ったメモは作られない／空にしたメモは消える', (tester) async {
    await start(tester, bodies: ['消すメモ']);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await back(tester);
    expect(db.rows.length, 1);
    await tester.tap(find.text('消すメモ'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '');
    await back(tester);
    expect(db.rows, isEmpty);
  });

  testWidgets('削除するとごみ箱に入り、「元に戻す」で戻る。ごみ箱から完全に削除できる', (tester) async {
    await start(tester, bodies: ['残すメモ', '大事なメモ']);
    await tester.tap(find.text('大事なメモ'));
    await tester.pumpAndSettle();
    await editorMenu(tester, '削除');
    expect(find.text('大事なメモ'), findsNothing);
    expect(db.rows['id1']!.inTrash, isTrue);
    await tester.tap(find.text('元に戻す'));
    await tester.pumpAndSettle();
    expect(find.text('大事なメモ'), findsOneWidget);

    await tester.longPress(find.text('大事なメモ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('削除（ごみ箱へ）'));
    await tester.pumpAndSettle();
    await openDrawer(tester);
    await tester.tap(find.text('ごみ箱'));
    await tester.pumpAndSettle();
    expect(find.text('大事なメモ'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing, reason: 'ごみ箱ではメモを作らない');
    await tester.tap(find.text('大事なメモ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('完全に削除'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, '削除'));
    await tester.pumpAndSettle();
    expect(db.rows.containsKey('id1'), isFalse);
    expect(find.text('ごみ箱は空です'), findsOneWidget);
  });

  testWidgets('☆を付けると古いメモでも一覧の先頭に固定される', (tester) async {
    await start(tester, bodies: ['古いメモ', '新しいメモ']);
    expect(listedTitles(tester), ['新しいメモ', '古いメモ']);
    await tester.longPress(find.text('古いメモ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('☆を付ける（先頭に固定）'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), ['古いメモ', '新しいメモ']);
    expect(find.byIcon(Icons.star), findsOneWidget);
  });

  testWidgets('横メニューから新しいフォルダを作ると、そのフォルダに切り替わり、作ったメモはそこに入る', (tester) async {
    await start(tester, bodies: ['私のノートのメモ']);
    await openDrawer(tester);
    await tester.tap(find.text('新しいフォルダ'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '仕事のためのアイデア');
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.text('仕事のためのアイデア'), findsOneWidget, reason: 'タイトルがフォルダ名になる');
    expect(find.text('このフォルダにメモはありません'), findsOneWidget);

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '改善のための提案');
    await back(tester); // 自動保存を待たずにすぐ戻っても保存される
    expect(listedTitles(tester), ['改善のための提案']);

    await openDrawer(tester);
    await tester.tap(find.text('私のノート'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), ['私のノートのメモ']);
  });

  testWidgets('「色」でナイトモードとアプリの色を切り替えられる', (tester) async {
    await start(tester);
    await openDrawer(tester);
    await tester.tap(find.text('色'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(settings.themeMode, ThemeMode.dark);
    expect(Theme.of(tester.element(find.text('アプリの色'))).brightness, Brightness.dark);
    await tester.tap(find.bySemanticsLabel('緑'));
    await tester.pumpAndSettle();
    expect(settings.appColor, appColors[2].$2);
  });

  testWidgets('編集を元に戻す・最後へ', (tester) async {
    await start(tester, bodies: ['一行目']);
    await tester.tap(find.text('一行目'));
    await tester.pumpAndSettle();
    final field = find.byType(TextField);
    await tester.tap(field); // 実際の操作と同じく、先にタップしてから打つ（同時だと履歴が残らない）
    await tester.pump(const Duration(seconds: 1));
    await tester.enterText(field, '一行目\n追記');
    await tester.pump(const Duration(seconds: 1));
    await editorMenu(tester, '編集を元に戻す');
    expect(tester.widget<TextField>(field).controller!.text, '一行目');
    await editorMenu(tester, '最後へ');
    final c = tester.widget<TextField>(field).controller!;
    expect(c.selection.baseOffset, c.text.length);
  });

  testWidgets('検索で本文も含めて絞り込める', (tester) async {
    await start(tester, bodies: ['りんご', 'みかん\nりんごと一緒に', 'ぶどう']);
    await tester.tap(find.byTooltip('検索'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'りんご');
    await tester.pump();
    expect(listedTitles(tester), unorderedEquals(['りんご', 'みかん']));
  });

  testWidgets('バックグラウンドから戻るとロック画面になり、PIN で解除できる', (tester) async {
    await start(tester, bodies: ['秘密のメモ']);
    await lock.setSecret(LockType.pin, '2468');
    for (final s in [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused, AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]) {
      tester.binding.handleAppLifecycleStateChanged(s);
    }
    await tester.pumpAndSettle();
    expect(find.byType(LockScreen), findsOneWidget);
    expect(find.text('秘密のメモ'), findsNothing, reason: 'ロック中は下の画面を描かない');

    for (final d in ['1', '1', '1', '1']) {
      await tester.tap(find.text(d));
      await tester.pump();
    }
    await tester.pumpAndSettle();
    expect(find.textContaining('違います'), findsOneWidget);
    for (final d in ['2', '4', '6', '8']) {
      await tester.tap(find.text(d));
      await tester.pump();
    }
    await tester.pumpAndSettle();
    expect(find.byType(LockScreen), findsNothing);
    expect(find.text('秘密のメモ'), findsOneWidget);
  });

  testWidgets('一覧と明細の文字サイズは別々に設定でき、明細には行間・文字間も反映される', (tester) async {
    await start(tester, bodies: ['見出し\n本文']);
    expect(tester.widget<Text>(find.text('見出し')).style!.fontSize, SettingsController.defaultListFontSize);
    await settings.setListFontSize(24);
    await settings.setDetailFontSize(14);
    await settings.setLineHeight(1.2);
    await settings.setLetterSpacing(-0.5);
    await tester.pumpAndSettle();
    expect(tester.widget<Text>(find.text('見出し')).style!.fontSize, 24);
    await tester.tap(find.text('見出し'));
    await tester.pumpAndSettle();
    final style = tester.widget<TextField>(find.byType(TextField)).style!;
    expect([style.fontSize, style.height, style.letterSpacing], [14, 1.2, -0.5]);
  });

  Future<void> openSettings(WidgetTester tester) async {
    await openDrawer(tester);
    await tester.tap(find.text('設定'));
    await tester.pumpAndSettle();
  }

  testWidgets('設定画面にはスライダーを置かず、「文字の大きさ・行間」を開いたときだけ調整できる', (tester) async {
    PackageInfo.setMockInitialValues(appName: 'FastNote', packageName: 'com.sapcework.fastnote', version: '1.1.0', buildNumber: '2', buildSignature: '');
    await start(tester);
    await openSettings(tester);
    expect(find.byType(Slider), findsNothing, reason: 'スクロール中にうっかり触れて変わらないように');
    expect(find.text('一覧 18・明細 16・行間 1.30・間隔 -0.3'), findsOneWidget);
    await tester.tap(find.text('文字の大きさ・行間'));
    await tester.pumpAndSettle();
    expect(find.byType(Slider), findsNWidgets(4));
    await tester.scrollUntilVisible(find.text('初期値に戻す'), 300, scrollable: _scrollableIn(find.byType(TextLayoutScreen)));
    await tester.tap(find.text('初期値に戻す'));
    await tester.pumpAndSettle();
  });

  testWidgets('「FastNote について」にバージョンと更新履歴が出る', (tester) async {
    PackageInfo.setMockInitialValues(appName: 'FastNote', packageName: 'com.sapcework.fastnote', version: '1.1.0', buildNumber: '2', buildSignature: '');
    await start(tester, bodies: ['メモ']);
    await openSettings(tester);
    await tester.scrollUntilVisible(find.text('FastNote について'), 300, scrollable: _scrollableIn(find.byType(SettingsScreen)));
    expect(find.text('バージョン 1.1.0（ビルド 2）'), findsOneWidget);
    await tester.ensureVisible(find.text('FastNote について')); // 下端ぎりぎりだとタップが届かないので、画面内に入れてから押す
    await tester.pumpAndSettle();
    await tester.tap(find.text('FastNote について'));
    await tester.pumpAndSettle();
    expect(find.text('バージョン 1.1.0（ビルド 2）'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('1 件'), 300, scrollable: _scrollableIn(find.byType(AboutScreen)));
    expect(find.text('1 件'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('1.1.0（2026-10-17）'), 300, scrollable: _scrollableIn(find.byType(AboutScreen)));
    expect(find.text('1.1.0（2026-10-17）'), findsOneWidget);
  });
}
