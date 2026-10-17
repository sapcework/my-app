import 'dart:convert';

import 'package:crypto/crypto.dart';

// 高速メモ帳のバックアップの解析（tool/fastnote-export.html の parseBackup と同じ処理）
//
// 形式: <本文の SHA-1 40桁>#<JSON1>{[!*|@]}<JSON2>{[!*|@]}<JSON3>
//   JSON1: {"index":"^!<id>;;<文字色>;<更新UNIX秒>;;<背景色>;<本文文字数>;;<リマインダーJSON>;<タイトル>^!..."}
//   JSON2: 用途不明（サンプルでは常に {}）
//   JSON3: {"_<id>": 本文, "ScrollY_<id>": 数値}

const _sectionSep = '{[!*|@]}';
final _backupRe = RegExp(r'^\uFEFF?[0-9a-fA-F]{40}#\{');
final _entryRe = RegExp(r'\^!([0-9a-z]{1,32});([^;]*);(#[0-9A-Fa-f]{8});(\d+);([^;]*);(#[0-9A-Fa-f]{8});(\d+);([^;]*);'); // index の1件分の先頭部分

bool looksLikeFastNoteBackup(String text) => _backupRe.hasMatch(text);

class BackupNote {
  final String id, title, body;
  final int? updatedUnix; // 秒（一覧に無いメモは null）
  final String? textColor, bgColor;
  const BackupNote({required this.id, required this.title, required this.body, this.updatedUnix, this.textColor, this.bgColor});
}

class FastNoteBackup {
  final List<BackupNote> notes; // 表示順。本文が無いものは含めない
  final bool hashOk; // 先頭の SHA-1 と本文が一致したか
  final List<String> warnings;
  const FastNoteBackup(this.notes, this.hashOk, this.warnings);
}

int _findJsonEnd(String s, int pos) { // s[pos] から始まる JSON オブジェクトの終わり（直後の位置）。文字列中の括弧は数えない
  if (pos >= s.length || s[pos] != '{') throw FormatException('バックアップの $pos 文字目にデータがありません（ファイルが壊れている可能性があります）');
  var depth = 0;
  var inStr = false, esc = false;
  for (var i = pos; i < s.length; i++) {
    final c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c == '\\') {
        esc = true;
      } else if (c == '"') {
        inStr = false;
      }
      continue;
    }
    if (c == '"') {
      inStr = true;
    } else if (c == '{') {
      depth++;
    } else if (c == '}' && --depth == 0) {
      return i + 1;
    }
  }
  throw const FormatException('バックアップが途中で終わっています（ファイルが壊れている可能性があります）');
}

FastNoteBackup parseFastNoteBackup(String text) {
  final warnings = <String>[];
  var src = text.startsWith('\uFEFF') ? text.substring(1) : text; // BOM と末尾の改行を除く
  src = src.trimRight();
  final sharp = src.indexOf('#');
  if (sharp != 40) throw const FormatException('高速メモ帳のバックアップ形式ではありません');
  final hash = src.substring(0, 40).toLowerCase();
  final body = src.substring(41);
  final hashOk = sha1.convert(utf8.encode(body)).toString() == hash;

  final sections = <Map<String, dynamic>>[];
  var pos = 0;
  for (var n = 0; n < 3; n++) { // JSON を3つ順に切り出す（区切りが本文に含まれていても壊れないように括弧の対応で切る）
    if (n > 0) {
      if (!body.startsWith(_sectionSep, pos)) throw FormatException('バックアップの ${n + 1} 番目のデータの区切りが見つかりません');
      pos += _sectionSep.length;
    }
    final end = _findJsonEnd(body, pos);
    final v = jsonDecode(body.substring(pos, end));
    if (v is! Map<String, dynamic>) throw const FormatException('バックアップの形式が想定と違います');
    sections.add(v);
    pos = end;
  }
  if (pos != body.length) warnings.add('末尾に解釈できないデータが ${body.length - pos} 文字あります');

  final [meta, extra, data] = sections;
  if (extra.isNotEmpty) warnings.add('用途不明のデータ（${extra.length} 項目）があります。メモの本文以外の情報のため取り込みません');

  final contents = <String, String>{}; // id → 本文（挿入順を保つ）
  data.forEach((k, v) {
    if (k.startsWith('_')) contents[k.substring(1)] = '$v';
  });

  final index = meta['index'] is String ? meta['index'] as String : '';
  final heads = _entryRe.allMatches(index).toList();
  if (index.isNotEmpty && (heads.isEmpty || heads.first.start != 0)) {
    warnings.add('メモ一覧の先頭 ${heads.isEmpty ? index.length : heads.first.start} 文字を解釈できませんでした');
  }

  final notes = <BackupNote>[];
  final seen = <String>{};
  for (final (i, m) in heads.indexed) {
    final id = m.group(1)!;
    final rest = index.substring(m.end, i + 1 < heads.length ? heads[i + 1].start : index.length); // 次のメモの手前まで
    var title = rest;
    if (rest.startsWith('{')) { // リマインダー JSON を飛ばしてタイトルを取る
      try {
        final e = _findJsonEnd(rest, 0);
        title = rest.startsWith(';', e) ? rest.substring(e + 1) : rest.substring(e);
      } on FormatException {
        warnings.add('「$id」のリマインダー情報を解釈できませんでした');
      }
    }
    if (!seen.add(id)) {
      warnings.add('「$title」が一覧に重複しています');
      continue;
    }
    final b = contents[id];
    if (b == null) {
      warnings.add('「$title」は一覧にありますが本文がないため取り込みません');
      continue;
    }
    final recorded = int.parse(m.group(7)!);
    if (b.runes.length != recorded && b.length != recorded) {
      warnings.add('「$title」の文字数が記録（$recorded）と本文（${b.runes.length}）で一致しません');
    }
    notes.add(BackupNote(id: id, title: title, body: b, updatedUnix: int.parse(m.group(4)!), textColor: m.group(3), bgColor: m.group(6)));
  }
  contents.forEach((id, b) { // 本文はあるが一覧にないもの。捨てずに後ろへ足す
    if (seen.contains(id)) return;
    final title = b.split('\n').first;
    warnings.add('「$title」は一覧にありませんが本文があるため、最後に追加します');
    notes.add(BackupNote(id: id, title: title, body: b));
  });
  return FastNoteBackup(notes, hashOk, warnings);
}
