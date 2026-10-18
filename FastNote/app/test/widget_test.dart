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
import 'package:fastnote/ui/note_list_screen.dart';
import 'package:fastnote/ui/startup_error_app.dart';
import 'package:fastnote/ui/widgets/max_width.dart';
import 'package:fastnote/ui/settings_screen.dart';
import 'package:fastnote/ui/text_layout_screen.dart';
import 'package:fastnote/ui/widgets/backup_password_dialog.dart';
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
  Future<void> clearColors(Iterable<String> ids) async {
    for (final id in ids) {
      rows[id] = rows[id]!.copyWith(textColor: () => null, bgColor: () => null);
    }
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

  List<String> listedTitles(WidgetTester tester) => [for (final t in tester.widgetList<NoteTile>(find.byType(NoteTile))) t.note.title];

  double? titleFontSize(WidgetTester tester, String title) => // 一覧のタイトルは検索語を太字にするため Text.rich で描いている
      (tester.widget<Text>(find.text(title)).textSpan as TextSpan?)?.children?.first.style?.fontSize;

  testWidgets('新しいメモを書いて戻ると一覧の先頭に出て、「保存されました」と出る', (tester) async {
    await start(tester, bodies: ['前からあるメモ']);
    expect(find.text('マイノート'), findsOneWidget);
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

    await tester.longPress(find.text('大事なメモ')); // 長押しで選択モード
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('削除'));
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
    await tester.tap(find.byTooltip('☆を付ける'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), ['古いメモ', '新しいメモ']);
    expect(find.byIcon(Icons.star), findsOneWidget);
  });

  testWidgets('横メニューから新しいフォルダを作ると、そのフォルダに切り替わり、作ったメモはそこに入る', (tester) async {
    await start(tester, bodies: ['マイノートのメモ']);
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
    await tester.tap(find.text('マイノート'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), ['マイノートのメモ']);
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
    expect(titleFontSize(tester, '見出し'), SettingsController.defaultListFontSize);
    await settings.setListFontSize(24);
    await settings.setDetailFontSize(14);
    await settings.setLineHeight(1.2);
    await settings.setLetterSpacing(-0.5);
    await tester.pumpAndSettle();
    expect(titleFontSize(tester, '見出し'), 24);
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
    expect(find.text('一覧 18・明細 16・行間 1.30・間隔 -0.3・余白 4'), findsOneWidget);
    await tester.tap(find.text('文字の大きさ・行間'));
    await tester.pumpAndSettle();
    expect(find.byType(Slider), findsNWidgets(5));
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

  testWidgets('バックアップのパスワード：短すぎる・確認が一致しないときは進めない', (tester) async {
    String? result = 'まだ';
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => TextButton(
          onPressed: () async => result = await askBackupPassword(context, confirm: true),
          child: const Text('開く'),
        ))));
    await tester.tap(find.text('開く'));
    await tester.pumpAndSettle();
    expect(find.textContaining('誰にも復元できません'), findsOneWidget);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'abc');
    await tester.enterText(fields.at(1), 'abc');
    await tester.tap(find.text('暗号化して書き出す'));
    await tester.pump();
    expect(find.text('8文字以上にしてください'), findsOneWidget); // 入力欄の見出し「（8文字以上）」と区別する
    await tester.enterText(fields.at(0), 'abcd1234');
    await tester.enterText(fields.at(1), 'abcd1235');
    await tester.tap(find.text('暗号化して書き出す'));
    await tester.pump();
    expect(find.text('確認用の入力が一致しません'), findsOneWidget);
    await tester.enterText(fields.at(1), 'abcd1234');
    await tester.tap(find.text('暗号化して書き出す'));
    await tester.pumpAndSettle();
    expect(result, 'abcd1234');
  });

  testWidgets('長押しで選択モードになり、まとめて削除しても「元に戻す」で全件戻る。戻るボタンで選択を解除できる', (tester) async {
    await start(tester, bodies: ['一つ目', '二つ目', '三つ目']);
    await tester.longPress(find.text('一つ目'));
    await tester.pumpAndSettle();
    expect(find.text('1 件を選択'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing, reason: '選択中は新規作成を出さない');
    await tester.tap(find.text('二つ目')); // 選択中のタップは選択の足し引き
    await tester.pumpAndSettle();
    expect(find.text('2 件を選択'), findsOneWidget);

    await tester.tap(find.byTooltip('削除'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), ['三つ目']);
    expect(find.text('2 件のメモをごみ箱に移しました'), findsOneWidget);
    await tester.tap(find.text('元に戻す'));
    await tester.pumpAndSettle();
    expect(listedTitles(tester), unorderedEquals(['一つ目', '二つ目', '三つ目']));

    await tester.longPress(find.text('三つ目'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('すべて選択'));
    await tester.pumpAndSettle();
    expect(find.text('3 件を選択'), findsOneWidget);
    await tester.binding.handlePopRoute(); // 端末の戻るボタン
    await tester.pumpAndSettle();
    expect(find.textContaining('件を選択'), findsNothing);
    expect(find.byType(FloatingActionButton), findsOneWidget);
  });

  testWidgets('検索すると、本文で一致した箇所の前後が出て、検索語が太字になる', (tester) async {
    await start(tester, bodies: ['買い物\n牛乳と卵とパン', '予定\n会議']);
    await tester.tap(find.byTooltip('検索'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '卵');
    await tester.pump();
    expect(listedTitles(tester), ['買い物']);
    final snippet = tester.widget<Text>(find.text('牛乳と卵とパン'));
    final bold = (snippet.textSpan! as TextSpan).children!.whereType<TextSpan>().where((s) => s.style?.fontWeight == FontWeight.bold);
    expect(bold.map((s) => s.text), ['卵']);
  });

  testWidgets('タブレットのような広い画面では、一覧の幅を720px以内に収める', (tester) async {
    tester.view.physicalSize = const Size(1600, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await start(tester, bodies: ['広い画面のメモ']);
    expect(tester.getSize(find.byType(NoteTile)).width, lessThanOrEqualTo(contentMaxWidth));
  });

  testWidgets('起動に失敗したときは、白い画面ではなく原因と対処を出す', (tester) async {
    await tester.pumpWidget(const StartupErrorApp(error: FileSystemException('No space left on device')));
    expect(find.text('FastNote を起動できませんでした'), findsOneWidget);
    expect(find.text('端末の空き容量が足りません'), findsOneWidget);
    expect(find.textContaining('削除はしないでください'), findsOneWidget);
  });
}
