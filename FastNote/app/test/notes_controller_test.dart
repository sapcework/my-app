import 'package:fastnote/data/note_db.dart';
import 'package:fastnote/state/notes.dart';
import 'package:fastnote/state/settings.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();
  late NoteDb db;
  late NotesController notes;
  var clock = 1000;

  setUp(() async {
    db = await NoteDb.open(factory: databaseFactoryFfi, path: inMemoryDatabasePath);
    clock = 1000;
    notes = NotesController(db, now: () => clock);
    await notes.load();
  });

  tearDown(() => db.close());

  Future<List<String>> bodiesInDb() async => (await db.all()).map((n) => n.body).toList();

  test('作成したメモは一番上に入り、DB にも残る', () async {
    await notes.create('一つ目');
    clock = 2000;
    await notes.create('二つ目');
    expect(notes.notes.map((n) => n.body), ['二つ目', '一つ目']);
    expect(await bodiesInDb(), ['二つ目', '一つ目']);
  });

  test('本文の更新で更新日時が変わり、色の変更では変わらない', () async {
    final n = await notes.create('a');
    clock = 5000;
    await notes.updateBody(n.id, 'b');
    expect(notes.byId(n.id)!.updatedAt, 5000);
    clock = 9000;
    await notes.updateColors(n.id, bg: '#FFFFF3B0', fg: null);
    final saved = (await db.all()).single;
    expect(saved.body, 'b');
    expect(saved.updatedAt, 5000);
    expect(saved.bgColor, '#FFFFF3B0');
    await notes.updateColors(n.id, bg: null, fg: null);
    expect((await db.all()).single.bgColor, isNull);
  });

  test('削除と取り消しで元の位置に戻る', () async {
    for (final b in ['c', 'b', 'a']) {
      await notes.create(b);
    }
    final mid = notes.notes[1];
    await notes.delete(mid.id);
    expect(await bodiesInDb(), ['a', 'c']);
    await notes.restore(mid);
    expect(notes.notes.map((n) => n.body), ['a', 'b', 'c']);
    expect(await bodiesInDb(), ['a', 'b', 'c']);
  });

  test('手動並べ替えが DB に保存され、読み直しても同じ順', () async {
    for (final b in ['c', 'b', 'a']) {
      await notes.create(b);
    }
    await notes.reorder(0, 2); // a を一番下へ
    expect(notes.notes.map((n) => n.body), ['b', 'c', 'a']);
    final reloaded = NotesController(db);
    await reloaded.load();
    expect(reloaded.notes.map((n) => n.body), ['b', 'c', 'a']);
  });

  test('並び順と検索', () async {
    clock = 3000;
    await notes.create('いちご\nあまい');
    clock = 1000;
    await notes.create('バナナ');
    clock = 2000;
    await notes.create('Apple\nいちごではない');
    expect(notes.view(SortMode.manual, '').map((n) => n.title), ['Apple', 'バナナ', 'いちご']);
    expect(notes.view(SortMode.updatedDesc, '').map((n) => n.title), ['いちご', 'Apple', 'バナナ']);
    expect(notes.view(SortMode.updatedAsc, '').map((n) => n.title), ['バナナ', 'Apple', 'いちご']);
    expect(notes.view(SortMode.manual, 'いちご').map((n) => n.title), ['Apple', 'いちご'], reason: '本文も検索する');
    expect(notes.view(SortMode.manual, 'apple').map((n) => n.title), ['Apple'], reason: '大文字小文字を区別しない');
  });

  test('取り込みは既存メモの後ろに追加し、書き出しで全件出る', () async {
    await notes.create('既存');
    final plan = notes.planImport('表示順,ID,本文\n1,aaaa,取込1\n2,bbbb,取込2\n');
    await notes.applyImport(plan);
    expect(notes.notes.map((n) => n.body), ['既存', '取込1', '取込2']);
    expect(await bodiesInDb(), ['既存', '取込1', '取込2']);
    expect(notes.planImport('表示順,ID,本文\n1,aaaa,取込1\n').notes, isEmpty, reason: '2回目は増えない');
    final csv = notes.exportCsv();
    expect(RegExp(r'取込\d').allMatches(csv).length, 4, reason: 'タイトルと本文に1回ずつ');
  });
}
