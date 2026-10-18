import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:fastnote/data/fastnote_backup.dart';
import 'package:fastnote/data/note_csv.dart';
import 'package:flutter_test/flutter_test.dart';

String sample(String n) => File('../sample/FastNotepad_2026-07-16_$n').readAsStringSync();

String entry(String id, int ts, int len, String title, {String fg = '#00FF0000', String bg = '#FFFFFFFF'}) =>
    '^!$id;;$fg;$ts;;$bg;$len;;{"reminder":0};$title'; // index の1件分（JSON にする前の形）

String makeBackup(String index, Map<String, Object> data, {Map<String, Object> extra = const {}}) { // 正しいハッシュ付きのバックアップを作る
  final body = '${jsonEncode({'index': index})}{[!*|@]}${jsonEncode(extra)}{[!*|@]}${jsonEncode(data)}';
  return '${sha1.convert(utf8.encode(body))}#$body';
}

ImportPlan plan(String text, {Set<String> existing = const {}}) => planImport(text, existingIds: existing, startOrder: 0, nowMs: 0);

void main() {
  group('サンプルのバックアップ', () {
    test('メモなしは0件・警告なし・ハッシュ一致', () {
      final b = parseFastNoteBackup(sample(''));
      expect(b.notes, isEmpty);
      expect(b.warnings, isEmpty);
      expect(b.hashOk, isTrue);
    });

    test('1〜4 の本文と表示順', () {
      const expected = {
        '1': ['123\nあいう'],
        '2': ['123\nあいう', '456\nえおか'],
        '3': ['123\nあいう', '456\nえおか', '高速メモ帳\nきくけ'],
        '4': ['123\nあいう\na', '456\nえおか', '高速メモ帳\nきくけ'],
      };
      expected.forEach((n, bodies) {
        final b = parseFastNoteBackup(sample(n));
        expect(b.notes.map((x) => x.body), bodies, reason: 'sample $n');
        expect(b.warnings, isEmpty, reason: 'sample $n');
        expect(b.hashOk, isTrue, reason: 'sample $n');
      });
    });

    test('直接取り込みと、抽出ツールで CSV にしてからの取り込みが同じ結果になる', () {
      final direct = plan(sample('4'));
      final viaTool = plan(File('test/fixtures/tool_sample4.csv').readAsStringSync());
      expect(direct.source, ImportSource.backup);
      expect(viaTool.source, ImportSource.csv);
      expect(direct.notes.map((n) => n.toMap()), viaTool.notes.map((n) => n.toMap()));
    });

    test('2回目の取り込みでは増えない', () {
      final first = plan(sample('4'));
      final again = plan(sample('4'), existing: {for (final n in first.notes) n.id});
      expect(again.notes, isEmpty);
      expect(again.skippedExisting, 3);
    });
  });

  test('本文やタイトルに区切り文字・引用符（奇数個）・絵文字が含まれても壊れない', () {
    const t1 = 'a^!b;c{[!*|@]}d';
    const b1 = '$t1\n"引用は1つだけ\r\n😀{}}';
    final text = makeBackup(
      entry('aaaaaaaaaaaaaaaa', 1784182773, b1.runes.length, t1) + entry('bbbbbbbbbbbbbbbb', 1784183000, 1, 'x'),
      {'_aaaaaaaaaaaaaaaa': b1, '_bbbbbbbbbbbbbbbb': 'x', 'ScrollY_aaaaaaaaaaaaaaaa': 0},
    );
    final b = parseFastNoteBackup(text);
    expect(b.hashOk, isTrue);
    expect(b.warnings, isEmpty);
    expect(b.notes.map((n) => [n.title, n.body]), [
      [t1, b1],
      ['x', 'x'],
    ]);
    expect(plan(text).notes.first.body, '$t1\n"引用は1つだけ\n😀{}}', reason: '取り込み時に改行は LF に揃える');
  });

  test('色付きのメモは色を引き継ぎ、透明と白は「色なし」になる', () {
    final text = makeBackup(
      entry('aaaaaaaaaaaaaaaa', 1, 1, 'a', fg: '#FFD32F2F', bg: '#FFFFF3B0') + entry('bbbbbbbbbbbbbbbb', 1, 1, 'b'),
      {'_aaaaaaaaaaaaaaaa': 'a', '_bbbbbbbbbbbbbbbb': 'b'},
    );
    final notes = plan(text).notes;
    expect([notes[0].textColor, notes[0].bgColor], ['#FFD32F2F', '#FFFFF3B0']);
    expect([notes[1].textColor, notes[1].bgColor], [null, null]);
  });

  test('ハッシュ不一致は検出するが、取り込み自体はできる', () {
    final b = parseFastNoteBackup(sample('1').replaceFirst('あいう', 'かきく'));
    expect(b.hashOk, isFalse);
    expect(b.notes.single.body, '123\nかきく');
  });

  test('BOM と末尾の改行があっても読める', () {
    final b = parseFastNoteBackup('\uFEFF${sample('2')}\r\n');
    expect(b.notes.length, 2);
    expect(b.hashOk, isTrue);
  });

  test('一覧と本文の食い違い・文字数違い・用途不明のデータを警告する', () {
    final text = makeBackup(
      entry('aaaaaaaaaaaaaaaa', 1, 99, 'A') + entry('cccccccccccccccc', 2, 1, 'C'),
      {'_aaaaaaaaaaaaaaaa': 'A', '_bbbbbbbbbbbbbbbb': 'B\n本文'},
      extra: {'folder': 1},
    );
    final b = parseFastNoteBackup(text);
    expect(b.notes.map((n) => n.id[0]), ['a', 'b'], reason: '本文のない C は除き、一覧にない B は最後に足す');
    expect(b.notes.last.updatedUnix, isNull);
    final w = b.warnings.join('\n');
    expect(w, contains('文字数'));
    expect(w, contains('本文がないため'));
    expect(w, contains('一覧にありません'));
    expect(w, contains('用途不明'));
  });

  test('壊れたバックアップはエラー', () {
    final good = sample('2');
    expect(() => parseFastNoteBackup(good.substring(0, good.length - 10)), throwsFormatException);
    expect(() => plan('${'0' * 40}#{"index":""}{}{}'), throwsFormatException);
  });

  test('「高速メモ帳の色を取り込む」がオフなら、色だけを外して本文や日時は残す', () {
    final text = makeBackup(
      entry('aaaaaaaaaaaaaaaa', 1784182773, 1, 'a', fg: '#FF6A1B9A', bg: '#FFEDE7F6') + entry('bbbbbbbbbbbbbbbb', 1784183000, 1, 'b'),
      {'_aaaaaaaaaaaaaaaa': 'a', '_bbbbbbbbbbbbbbbb': 'b'},
    );
    final p = plan(text);
    expect(p.coloredCount, 1);
    final plain = p.withoutColors();
    expect(plain.coloredCount, 0);
    expect(plain.notes.map((n) => [n.id, n.body, n.updatedAt]), p.notes.map((n) => [n.id, n.body, n.updatedAt]));
    expect([plain.source, plain.hashOk, plain.skippedExisting], [p.source, p.hashOk, p.skippedExisting]);
  });

  test('バックアップでも CSV でもないファイルはエラー', () {
    expect(() => plan('ただのテキスト'), throwsFormatException);
  });
}
