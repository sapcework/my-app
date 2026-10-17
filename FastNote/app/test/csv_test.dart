import 'dart:io';

import 'package:fastnote/data/csv.dart';
import 'package:fastnote/data/note.dart';
import 'package:fastnote/data/note_csv.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseCsv', () {
    test('BOM・CRLF・引用符内の改行と二重引用符', () {
      final rows = parseCsv('\uFEFF"a","b"\r\n"1\n2","x""y"\r\n');
      expect(rows, [
        ['a', 'b'],
        ['1\n2', 'x"y'],
      ]);
    });

    test('引用符なし・LF のみ・末尾改行なし・空フィールド', () {
      expect(parseCsv('a,b,c\n1,,3'), [
        ['a', 'b', 'c'],
        ['1', '', '3'],
      ]);
    });

    test('空行は捨てるが、空文字1つの引用フィールドは残す', () {
      expect(parseCsv('a\n\n""\n'), [
        ['a'],
        [''],
      ]);
    });

    test('引用符が閉じていなければ、始まった行番号つきでエラー', () {
      expect(
        () => parseCsv('"a","b"\r\n"1","2"\r\n"3","途中で\n切れた'),
        throwsA(isA<FormatException>().having((e) => e.message, 'message', contains('3 行目から'))),
      );
    });

    test('フィールドの途中にある " はただの文字として読む', () {
      expect(parseCsv('本文\n身長5\'8"の人\n'), [
        ['本文'],
        ['身長5\'8"の人'],
      ]);
    });

    test('buildCsv → parseCsv で元に戻る', () {
      final rows = [
        ['見出し', 'x'],
        ['改行\nあり', 'カンマ,と"引用"'],
        ['😀', ''],
      ];
      final csv = buildCsv(rows);
      expect(csv.startsWith('\uFEFF"見出し","x"\r\n'), isTrue);
      expect(csv.endsWith('\r\n'), isTrue);
      expect(parseCsv(csv), rows);
    });
  });

  group('planCsvImport', () {
    test('抽出ツールの出力（sample_4）を取り込める', () {
      final text = File('test/fixtures/tool_sample4.csv').readAsStringSync();
      final plan = planCsvImport(text, existingIds: {}, startOrder: 0, nowMs: 0);
      expect(plan.skippedEmpty, 0);
      expect(plan.skippedExisting, 0);
      expect(plan.notes.map((n) => n.id), ['ba8dqhdjibuo521c', '8na67rhfr0f96196', '4ti5r5kp1qrthq1l']);
      expect(plan.notes.map((n) => n.body), ['123\nあいう\na', '456\nえおか', '高速メモ帳\nきくけ']);
      expect(plan.notes.map((n) => n.sortOrder), [0, 1, 2]);
      expect(plan.notes.first.updatedAt, 1784185594000);
      expect(plan.notes.first.title, '123');
      expect(plan.notes.first.textColor, isNull, reason: '#00FF0000 は透明＝色なし');
      expect(plan.notes.first.bgColor, isNull, reason: '#FFFFFFFF は既定の白');
    });

    test('既にある ID は飛ばし、同じ CSV を2回取り込んでも増えない', () {
      final text = File('test/fixtures/tool_sample4.csv').readAsStringSync();
      final plan = planCsvImport(text, existingIds: {'8na67rhfr0f96196'}, startOrder: 10, nowMs: 0);
      expect(plan.notes.map((n) => n.id), ['ba8dqhdjibuo521c', '4ti5r5kp1qrthq1l']);
      expect(plan.notes.map((n) => n.sortOrder), [10, 11]);
      expect(plan.skippedExisting, 1);
    });

    test('表示順で並べ、ID なし・不正な ID は新しく振り、空の本文は飛ばす', () {
      const text = '表示順,ID,本文,更新日時UNIX,文字色,背景色\n'
          '2,,二つ目,,#FFD32F2F,#FFFFF3B0\n'
          '1,ABC!,一つ目,100,,\n'
          '3,zzzz,"  ",,,\n';
      final plan = planCsvImport(text, existingIds: {}, startOrder: 0, nowMs: 5000);
      expect(plan.notes.map((n) => n.body), ['一つ目', '二つ目']);
      expect(plan.notes[0].updatedAt, 100000);
      expect(plan.notes[1].updatedAt, 5000, reason: '日時が無ければ取り込んだ時刻');
      expect(plan.notes[1].textColor, '#FFD32F2F');
      expect(plan.notes[1].bgColor, '#FFFFF3B0');
      expect(plan.notes.every((n) => RegExp(r'^[0-9a-z]{16}$').hasMatch(n.id)), isTrue);
      expect(plan.skippedEmpty, 1);
    });

    test('本文の CRLF は LF に揃える', () {
      final plan = planCsvImport('本文\r\n"a\r\nb"\r\n', existingIds: {}, startOrder: 0, nowMs: 0);
      expect(plan.notes.single.body, 'a\nb');
    });

    test('「本文」列が無い・空のファイルはエラー', () {
      expect(() => planCsvImport('a,b\n1,2', existingIds: {}, startOrder: 0, nowMs: 0), throwsFormatException);
      expect(() => planCsvImport('', existingIds: {}, startOrder: 0, nowMs: 0), throwsFormatException);
    });
  });

  test('書き出し → 取り込みで内容が元に戻る（バックアップと復元）', () {
    const notes = [
      Note(id: 'aaaaaaaaaaaaaaaa', body: 'タイトル\n本文,"引用"\n😀', sortOrder: 0, createdAt: 1, updatedAt: 1784185594000, bgColor: '#FFFFF3B0', textColor: '#FF1976D2'),
      Note(id: 'bbbbbbbbbbbbbbbb', body: 'もう一つ', sortOrder: 1, createdAt: 1, updatedAt: 1784183000000),
    ];
    final csv = notesToCsv(notes);
    final plan = planCsvImport(csv, existingIds: {}, startOrder: 0, nowMs: 0);
    expect(plan.notes.map((n) => n.toMap()..remove('created_at')), notes.map((n) => n.toMap()..remove('created_at')));
  });
}
