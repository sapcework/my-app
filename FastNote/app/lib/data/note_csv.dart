import 'package:intl/intl.dart';

import '../core/colors.dart';
import 'csv.dart';
import 'note.dart';

// CSV とメモの相互変換。列は「高速メモ帳 CSV 抽出ツール」と同じにして、
// ツールの出力もこのアプリの書き出し（バックアップ）も同じ手順で取り込めるようにする

const csvHeader = ['表示順', 'ID', 'タイトル', '本文', '更新日時', '更新日時UNIX', '文字色', '背景色', '文字数', 'リマインダー', '状態'];

final _idRe = RegExp(r'^[0-9a-z]{1,32}$');

String notesToCsv(List<Note> notes) { // notes は表示順に並んでいる前提
  final fmt = DateFormat('yyyy-MM-dd HH:mm:ss');
  return buildCsv([
    csvHeader,
    for (final (i, n) in notes.indexed)
      [
        i + 1,
        n.id,
        n.title,
        n.body,
        fmt.format(DateTime.fromMillisecondsSinceEpoch(n.updatedAt)),
        n.updatedAt ~/ 1000,
        n.textColor ?? '',
        n.bgColor ?? '',
        n.body.runes.length,
        '',
        '正常',
      ],
  ]);
}

class CsvImportPlan { // 取り込み前の確認用。apply するまで DB は変えない
  final List<Note> notes; // 新しく追加するメモ（表示順どおり）
  final int skippedExisting; // 同じ ID のメモが既にあるため飛ばした件数
  final int skippedEmpty; // 本文が空のため飛ばした件数
  const CsvImportPlan(this.notes, this.skippedExisting, this.skippedEmpty);
}

CsvImportPlan planCsvImport(
  String text, {
  required Set<String> existingIds,
  required int startOrder, // 追加するメモの最初の sort_order（既存メモの後ろに並べる）
  required int nowMs,
}) {
  final rows = parseCsv(text);
  if (rows.isEmpty) throw const FormatException('ファイルが空です');
  final header = rows.first.map((h) => h.trim()).toList();
  int col(String name) => header.indexOf(name);
  final iBody = col('本文');
  if (iBody < 0) {
    throw const FormatException('「本文」の列がありません。高速メモ帳 CSV 抽出ツール、またはこのアプリで書き出した CSV を選んでください');
  }
  final iOrder = col('表示順'), iId = col('ID'), iUnix = col('更新日時UNIX'), iFg = col('文字色'), iBg = col('背景色');
  String cell(List<String> r, int i) => i >= 0 && i < r.length ? r[i] : '';

  final data = rows.skip(1).toList();
  final indexed = data.indexed.toList(); // 表示順で並べ替える（同順位や不正値は元の行順）
  int orderOf((int, List<String>) e) => int.tryParse(cell(e.$2, iOrder).trim()) ?? (1 << 40) + e.$1;
  indexed.sort((a, b) {
    final c = orderOf(a).compareTo(orderOf(b));
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });

  final notes = <Note>[];
  final seen = <String>{...existingIds};
  var skippedExisting = 0, skippedEmpty = 0;
  for (final (_, r) in indexed) {
    final body = cell(r, iBody).replaceAll('\r\n', '\n').replaceAll('\r', '\n'); // 改行を LF に揃える
    if (body.trim().isEmpty) {
      skippedEmpty++;
      continue;
    }
    final csvId = cell(r, iId).trim();
    String id;
    if (_idRe.hasMatch(csvId)) {
      if (seen.contains(csvId)) { // 取り込み済み（同じ CSV を2回取り込んでも増えない）
        skippedExisting++;
        continue;
      }
      id = csvId;
    } else {
      do {
        id = newNoteId();
      } while (seen.contains(id));
    }
    seen.add(id);
    final unix = int.tryParse(cell(r, iUnix).trim());
    final updated = unix != null && unix > 0 ? unix * 1000 : nowMs;
    notes.add(Note(
      id: id,
      body: body,
      sortOrder: startOrder + notes.length,
      createdAt: updated, // 作成日時は CSV に無いので更新日時で代用する
      updatedAt: updated,
      textColor: normalizeArgb(cell(r, iFg), background: false),
      bgColor: normalizeArgb(cell(r, iBg), background: true),
    ));
  }
  return CsvImportPlan(notes, skippedExisting, skippedEmpty);
}
