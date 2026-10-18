import 'dart:io';

import 'package:fastnote/data/encrypted_backup.dart';
import 'package:fastnote/data/note.dart';
import 'package:fastnote/data/note_db.dart';
import 'package:fastnote/state/notes.dart';
import 'package:fastnote/state/reminders.dart';
import 'package:fastnote/state/settings.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class FakeReminders implements ReminderScheduler { // 予約・取り消しの呼び出しを記録する
  final scheduled = <String, int>{}; // メモ ID → 時刻
  @override
  Future<bool> requestPermission() async => true;
  @override
  Future<void> schedule(Note n) async => scheduled[n.id] = n.reminderAt!;
  @override
  Future<void> cancel(Note n) async => scheduled.remove(n.id);
}

void main() {
  sqfliteFfiInit();
  late NoteDb db;
  late NotesController notes;
  late FakeReminders reminders;
  var clock = 1000;

  setUp(() async {
    db = await NoteDb.open(factory: databaseFactoryFfi, path: inMemoryDatabasePath);
    clock = 1000;
    reminders = FakeReminders();
    notes = NotesController(db, reminders: reminders, now: () => clock);
    await notes.load();
  });

  tearDown(() => db.close());

  Future<NotesController> reload() async {
    final c = NotesController(db, reminders: reminders, now: () => clock);
    await c.load();
    return c;
  }

  List<String> titles(NoteScope s, [SortMode m = SortMode.updatedDesc, String q = '']) => notes.view(s, m, q).map((n) => n.title).toList();

  test('更新したメモが先頭に来る（高速メモ帳と同じ）', () async {
    final a = await notes.create('A');
    clock = 2000;
    await notes.create('B');
    expect(titles(NoteScope.home), ['B', 'A']);
    clock = 3000;
    await notes.updateBody(a.id, 'A2');
    expect(titles(NoteScope.home), ['A2', 'B']);
  });

  test('☆を付けたメモは更新が古くても先頭に固定され、色・☆の変更では並びが動かない', () async {
    final a = await notes.create('古い');
    clock = 2000;
    await notes.create('新しい');
    clock = 3000;
    await notes.setStarred(a.id, true);
    expect(titles(NoteScope.home), ['古い', '新しい']);
    expect(notes.byId(a.id)!.updatedAt, 1000, reason: '☆では更新日時を変えない');
    await notes.updateColors(a.id, bg: '#FFFFF3B0', fg: null);
    expect(notes.byId(a.id)!.updatedAt, 1000);
    final saved = (await reload()).byId(a.id)!;
    expect([saved.starred, saved.bgColor], [true, '#FFFFF3B0']);
  });

  test('並び順の切り替えと検索（☆はどの並びでも先頭）', () async {
    clock = 3000;
    final i = await notes.create('いちご\nあまい');
    clock = 1000;
    await notes.create('バナナ');
    clock = 2000;
    await notes.create('Apple\nいちごではない');
    expect(titles(NoteScope.home, SortMode.title), ['Apple', 'いちご', 'バナナ']);
    expect(titles(NoteScope.home, SortMode.createdDesc), ['いちご', 'Apple', 'バナナ']);
    await notes.setStarred(notes.notes.firstWhere((n) => n.title == 'バナナ').id, true);
    expect(titles(NoteScope.home, SortMode.title), ['バナナ', 'Apple', 'いちご']);
    expect(titles(NoteScope.home, SortMode.updatedDesc, 'いちご'), ['いちご', 'Apple'], reason: '本文も検索する');
    expect(titles(NoteScope.home, SortMode.updatedDesc, 'apple'), ['Apple'], reason: '大文字小文字を区別しない');
    expect(i.title, 'いちご');
  });

  test('フォルダの作成・移動・名前の変更・削除（中のメモは「マイノート」へ）', () async {
    final f = await notes.createFolder(' 仕事 ');
    expect(f.name, '仕事');
    final a = await notes.create('会議', folderId: f.id);
    await notes.create('買い物');
    expect(titles(NoteScope.folder(f.id)), ['会議']);
    expect(titles(NoteScope.home), ['買い物']);
    expect(notes.count(NoteScope.folder(f.id)), 1);

    await notes.renameFolder(f.id, '仕事のアイデア');
    expect(notes.scopeName(NoteScope.folder(f.id)), '仕事のアイデア');
    await notes.moveToFolder(a.id, null);
    expect(titles(NoteScope.home), containsAll(['会議', '買い物']));
    await notes.moveToFolder(a.id, f.id);

    await notes.deleteFolder(f.id);
    expect(notes.folders, isEmpty);
    expect(notes.byId(a.id)!.folderId, isNull);
    final r = await reload();
    expect(r.folders, isEmpty);
    expect(r.byId(a.id)!.folderId, isNull);
  });

  test('ごみ箱：移す・戻す・完全に削除・空にする', () async {
    final a = await notes.create('A');
    final b = await notes.create('B');
    await notes.create('C');
    clock = 5000;
    await notes.moveToTrash(a.id);
    clock = 6000;
    await notes.moveToTrash(b.id);
    expect(titles(NoteScope.home), ['C']);
    expect(titles(const NoteScope.trash()), ['B', 'A'], reason: 'ごみ箱は捨てた順');
    expect((await reload()).byId(a.id)!.deletedAt, 5000);

    await notes.restoreFromTrash(a.id);
    expect(titles(NoteScope.home), containsAll(['A', 'C']));
    await notes.deletePermanently(b.id);
    expect(notes.byId(b.id), isNull);

    await notes.moveToTrash(a.id);
    expect(await notes.emptyTrash(), 1);
    expect((await reload()).notes.map((n) => n.title), ['C']);
  });

  test('ごみ箱に入れたメモのフォルダが消えていたら、戻すと「マイノート」に入る', () async {
    final f = await notes.createFolder('一時');
    final a = await notes.create('A', folderId: f.id);
    await notes.moveToTrash(a.id);
    await notes.deleteFolder(f.id);
    await notes.restoreFromTrash(a.id);
    expect(notes.byId(a.id)!.folderId, isNull);
  });

  test('「元に戻す」で削除前の状態にそのまま戻る', () async {
    final a = await notes.create('A');
    await notes.setStarred(a.id, true);
    final before = notes.byId(a.id)!;
    await notes.moveToTrash(a.id);
    await notes.restore(before);
    expect(notes.byId(a.id)!.toMap(), before.toMap());
  });

  test('リマインダーの予約と取り消し（ごみ箱に入れると取り消し、戻すと予約し直す）', () async {
    final a = await notes.create('A');
    await notes.setReminder(a.id, 99000);
    expect(reminders.scheduled, {a.id: 99000});
    expect((await reload()).byId(a.id)!.reminderAt, 99000);
    await notes.moveToTrash(a.id);
    expect(reminders.scheduled, isEmpty);
    await notes.restoreFromTrash(a.id);
    expect(reminders.scheduled, {a.id: 99000});
    await notes.setReminder(a.id, null);
    expect(reminders.scheduled, isEmpty);
    expect(notes.byId(a.id)!.reminderAt, isNull);
  });

  test('取り込みは既存メモの後ろに追加し、2回目は増えない', () async {
    await notes.create('既存');
    await notes.applyImport(notes.planImportFrom('表示順,ID,本文\n1,aaaa,取込1\n2,bbbb,取込2\n'));
    expect(notes.notes.map((n) => n.body), ['既存', '取込1', '取込2']);
    expect(notes.planImportFrom('表示順,ID,本文\n1,aaaa,取込1\n').notes, isEmpty);
  });

  test('書き出し → 別の端末で取り込みで、フォルダ・☆・ごみ箱・リマインダーも戻る', () async {
    final f = await notes.createFolder('仕事');
    final a = await notes.create('会議メモ', folderId: f.id);
    await notes.setStarred(a.id, true);
    await notes.setReminder(a.id, 99000000);
    final b = await notes.create('捨てたメモ');
    await notes.moveToTrash(b.id);
    final csv = notes.exportCsv();

    final db2 = await NoteDb.open(factory: databaseFactoryFfi, path: inMemoryDatabasePath);
    final other = NotesController(db2, reminders: FakeReminders(), now: () => clock);
    await other.load();
    await other.createFolder('仕事'); // 同じ名前のフォルダがあればそこに入れる
    final plan = other.planImportFrom(csv);
    expect(plan.newFolders, isEmpty);
    await other.applyImport(plan);
    final a2 = other.byId(a.id)!;
    expect(other.folderById(a2.folderId)!.name, '仕事');
    expect([a2.starred, a2.reminderAt], [true, 99000000]);
    expect(other.byId(b.id)!.inTrash, isTrue);
    await db2.close();
  });

  test('取り込み先に無いフォルダは作る', () async {
    const csv = '本文,フォルダ\nメモ1,旅行\nメモ2,旅行\nメモ3,\n';
    final plan = notes.planImportFrom(csv);
    expect(plan.newFolders.map((f) => f.name), ['旅行']);
    await notes.applyImport(plan);
    final f = notes.folders.single;
    expect(titles(NoteScope.folder(f.id)), unorderedEquals(['メモ1', 'メモ2']));
    expect(titles(NoteScope.home), ['メモ3']);
  });

  test('版1のデータベースを開くと、メモを残したまま新しい項目が足される', () async {
    final dir = Directory.systemTemp.createTempSync('fastnote_db');
    final path = '${dir.path}/fastnote.db';
    final v1 = await databaseFactoryFfi.openDatabase(path,
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: (d, _) => d.execute('CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT NOT NULL, sort_order INTEGER NOT NULL, '
              'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, text_color TEXT, bg_color TEXT)'),
        ));
    await v1.insert('notes', {'id': 'old', 'body': '前からあるメモ', 'sort_order': 0, 'created_at': 1, 'updated_at': 1});
    await v1.close();

    final upgraded = await NoteDb.open(factory: databaseFactoryFfi, path: path);
    final n = (await upgraded.all()).single;
    expect([n.body, n.folderId, n.starred, n.deletedAt, n.reminderAt], ['前からあるメモ', null, false, null, null]);
    expect(await upgraded.folders(), isEmpty);
    await upgraded.close();
    dir.deleteSync(recursive: true);
  });

  test('暗号化バックアップ：書き出し → 暗号化 → 別の端末で復号 → 取り込みで、フォルダ・☆まで戻る', () async {
    final f = await notes.createFolder('家計');
    final a = await notes.create('口座番号メモ', folderId: f.id);
    await notes.setStarred(a.id, true);
    final enc = await encryptBackup(notes.exportCsv(), 'secret-pw', iterations: 1000);

    final db2 = await NoteDb.open(factory: databaseFactoryFfi, path: inMemoryDatabasePath);
    final other = NotesController(db2, reminders: FakeReminders(), now: () => clock);
    await other.load();
    expect(() => decryptBackup(enc, 'wrong'), throwsA(isA<BackupPasswordException>()));
    await other.applyImport(other.planImportFrom(await decryptBackup(enc, 'secret-pw')));
    final a2 = other.byId(a.id)!;
    expect([a2.body, a2.starred, other.folderById(a2.folderId)!.name], ['口座番号メモ', true, '家計']);
    await db2.close();
  });

  test('メモの色をすべて消す：色付きのメモだけ消え、更新日時と並びは変わらない', () async {
    final a = await notes.create('青いメモ');
    clock = 2000;
    final b = await notes.create('色なしのメモ');
    await notes.updateColors(a.id, bg: '#FFE3F2FD', fg: '#1A2196F3');
    expect(notes.coloredCount, 1);
    final before = titles(NoteScope.home);
    expect(await notes.clearAllColors(), 1);
    expect([notes.byId(a.id)!.bgColor, notes.byId(a.id)!.textColor], [null, null]);
    expect(notes.byId(a.id)!.updatedAt, 1000);
    expect(notes.byId(b.id)!.updatedAt, 2000);
    expect(titles(NoteScope.home), before);
    expect(notes.coloredCount, 0);
    final saved = (await reload()).byId(a.id)!;
    expect([saved.bgColor, saved.textColor], [null, null]);
    expect(await notes.clearAllColors(), 0);
  });

  test('CSV のフォルダ列が旧名「私のノート」でも、フォルダを作らずにマイノートに入れる', () async {
    final plan = notes.planImportFrom('本文,フォルダ\n旧版のメモ,私のノート\n新版のメモ,マイノート\n');
    expect(plan.newFolders, isEmpty);
    expect(plan.notes.every((n) => n.folderId == null), isTrue);
  });

  test('別の画面で消されたメモを操作しても落ちない', () async {
    final a = await notes.create('A');
    await notes.deletePermanently(a.id);
    expect(await notes.updateBody(a.id, 'x'), isNull);
    expect(await notes.setStarred(a.id, true), isNull);
    expect(await notes.moveToFolder(a.id, null), isNull);
    expect(await notes.setReminder(a.id, 99000), isNull);
    expect(await notes.moveToTrash(a.id), isNull);
    expect(await notes.restoreFromTrash(a.id), isNull);
    await notes.deletePermanently(a.id);
    expect(reminders.scheduled, isEmpty);
  });

  test('まとめて☆・移動・色・削除し、「元に戻す」で全件が元どおりになる', () async {
    final f = await notes.createFolder('仕事');
    final a = await notes.create('A'), b = await notes.create('B'), c = await notes.create('C');
    await notes.setStarredMany([a.id, b.id], true);
    await notes.moveManyToFolder([a.id, b.id], f.id);
    await notes.updateColorsMany([a.id, b.id], bg: '#FFFFF3B0', fg: null);
    final r = await reload();
    expect([for (final id in [a.id, b.id, c.id]) [r.byId(id)!.starred, r.byId(id)!.folderId == f.id, r.byId(id)!.bgColor]], [
      [true, true, '#FFFFF3B0'],
      [true, true, '#FFFFF3B0'],
      [false, false, null],
    ]);

    final before = await notes.trashMany([a.id, b.id, 'missing']);
    expect(before.map((n) => n.id), unorderedEquals([a.id, b.id]));
    expect(notes.count(const NoteScope.trash()), 2);
    await notes.restoreAll(before);
    expect(notes.count(const NoteScope.trash()), 0);
    expect(notes.byId(a.id)!.toMap(), before.firstWhere((n) => n.id == a.id).toMap());

    await notes.trashMany([a.id, b.id]);
    await notes.restoreManyFromTrash([a.id]);
    await notes.deleteManyPermanently([b.id]);
    expect((await reload()).notes.map((n) => n.title), unorderedEquals(['A', 'C']));
  });

  test('取り込み直し：取り込む側が新しく本文が違えば更新し、FastNote 側の☆・フォルダは残す', () async {
    final f = await notes.createFolder('仕事');
    await notes.applyImport(notes.planImportFrom('ID,本文,更新日時UNIX\naaaa,最初の本文,100\nbbbb,そのまま,100\ncccc,捨てる,100\n'));
    await notes.setStarred('aaaa', true);
    await notes.moveToFolder('aaaa', f.id);
    await notes.moveToTrash('cccc');

    final plan = notes.planImportFrom('ID,本文,更新日時UNIX\naaaa,書き換えた本文,200\nbbbb,そのまま,300\ncccc,ごみ箱のメモ,300\ndddd,新しいメモ,300\n');
    expect(plan.updates.map((n) => n.id), ['aaaa'], reason: '本文が同じもの・ごみ箱のものは更新しない');
    expect(plan.notes.map((n) => n.id), ['dddd']);
    expect(plan.skippedExisting, 2);
    await notes.applyImport(plan);
    final a = (await reload()).byId('aaaa')!;
    expect([a.body, a.updatedAt, a.starred, a.folderId], ['書き換えた本文', 200000, true, f.id]);
    expect(notes.byId('cccc')!.body, '捨てる');
  });

  test('取り込み直し：FastNote 側で書き換えた方が新しければ残す', () async {
    await notes.applyImport(notes.planImportFrom('ID,本文,更新日時UNIX\naaaa,高速メモ帳の本文,100\n'));
    clock = 500000;
    await notes.updateBody('aaaa', 'FastNote で書き換えた本文');
    final plan = notes.planImportFrom('ID,本文,更新日時UNIX\naaaa,高速メモ帳で書き換えた本文,200\n');
    expect(plan.isEmpty, isTrue);
    expect(plan.skippedExisting, 1);
  });
}
