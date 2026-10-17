import 'dart:io';

import 'package:fastnote/app.dart';
import 'package:fastnote/data/note.dart';
import 'package:fastnote/data/note_db.dart';
import 'package:fastnote/state/json_file.dart';
import 'package:fastnote/state/lock.dart';
import 'package:fastnote/state/notes.dart';
import 'package:fastnote/state/settings.dart';
import 'package:fastnote/ui/lock_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// 画面の流れのテスト。ファイルや DB への実 I/O はフェイク時計の下では完了しないためメモリ上の代用品を使う

class MemoryNoteDb implements NoteDb {
  final rows = <String, Note>{};
  @override
  Future<List<Note>> all() async => rows.values.toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  @override
  Future<void> upsert(Note n) async => rows[n.id] = n;
  @override
  Future<void> delete(String id) async => rows.remove(id);
  @override
  Future<void> insertAll(List<Note> notes) async => rows.addAll({for (final n in notes) n.id: n});
  @override
  Future<void> updateOrders(Map<String, int> orders) async =>
      orders.forEach((id, o) => rows[id] = rows[id]!.copyWith(sortOrder: o));
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

Future<String> fastHash(String secret, String salt) async => '$salt:$secret';

void main() {
  late MemoryNoteDb db;
  late NotesController notes;
  late SettingsController settings;
  late LockController lock;

  Future<void> start(WidgetTester tester, {List<String> bodies = const []}) async {
    db = MemoryNoteDb();
    for (final (i, b) in bodies.indexed) {
      db.rows['id$i'] = Note(id: 'id$i', body: b, sortOrder: i, createdAt: 0, updatedAt: 0);
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

  testWidgets('新しいメモを書いて戻ると一覧に出る（1行目がタイトル）', (tester) async {
    await start(tester);
    expect(find.textContaining('メモはまだありません'), findsOneWidget);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '買い物\n牛乳\n卵');
    await tester.pump(const Duration(seconds: 1)); // 自動保存を待つ
    expect(db.rows.values.single.body, '買い物\n牛乳\n卵', reason: '戻る前に保存されている');
    await back(tester);
    expect(find.text('買い物'), findsOneWidget);
    expect(find.text('牛乳 卵'), findsOneWidget);
    expect(find.text('メモ（1）'), findsOneWidget);
  });

  testWidgets('何も書かずに戻ったメモは作られない', (tester) async {
    await start(tester);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await back(tester);
    expect(db.rows, isEmpty);
  });

  testWidgets('既存のメモを空にして戻ると消える', (tester) async {
    await start(tester, bodies: ['消すメモ']);
    await tester.tap(find.text('消すメモ'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '');
    await back(tester);
    expect(db.rows, isEmpty);
  });

  testWidgets('編集画面で削除し、「元に戻す」で復元できる', (tester) async {
    await start(tester, bodies: ['残すメモ', '大事なメモ']);
    await tester.tap(find.text('大事なメモ'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('削除'));
    await tester.pumpAndSettle();
    expect(find.text('大事なメモ'), findsNothing);
    expect(db.rows.length, 1);
    await tester.tap(find.text('元に戻す'));
    await tester.pumpAndSettle();
    expect(find.text('大事なメモ'), findsOneWidget);
    expect(db.rows.length, 2);
  });

  testWidgets('検索で本文も含めて絞り込める', (tester) async {
    await start(tester, bodies: ['りんご', 'みかん\nりんごと一緒に', 'ぶどう']);
    await tester.tap(find.byTooltip('検索'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'りんご');
    await tester.pump();
    expect(find.text('りんご'), findsWidgets);
    expect(find.text('みかん'), findsOneWidget);
    expect(find.text('ぶどう'), findsNothing);
  });

  testWidgets('バックグラウンドから戻るとロック画面になり、PIN で解除できる', (tester) async {
    await start(tester, bodies: ['秘密のメモ']);
    await lock.setSecret(LockType.pin, '2468');
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
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

  testWidgets('文字サイズの設定が一覧に反映される', (tester) async {
    await start(tester, bodies: ['大きな文字']);
    await settings.setFontSize(24);
    await tester.pumpAndSettle();
    expect(tester.widget<Text>(find.text('大きな文字')).style!.fontSize, 24);
  });
}
