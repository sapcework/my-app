import 'package:intl/intl.dart';

import '../core/colors.dart';
import 'csv.dart';
import 'fastnote_backup.dart';
import 'note.dart';

// メモの取り込み（高速メモ帳のバックアップ・CSV）と CSV 書き出し。
// 先頭の11列は「高速メモ帳 CSV 抽出ツール」と同じ。このアプリで足した情報は後ろの列に置くので、
// ツールの出力（11列）もこのアプリの書き出しも同じ手順で取り込める

const csvHeader = [
  '表示順', 'ID', 'タイトル', '本文', '更新日時', '更新日時UNIX', '文字色', '背景色', '文字数', 'リマインダー', '状態', // 抽出ツールと共通
  'フォルダ', '☆', '削除日時UNIX', 'リマインダーUNIX', // このアプリで追加
];

final _idRe = RegExp(r'^[0-9a-z]{1,32}$');

String notesToCsv(List<Note> notes, {String Function(String? folderId)? folderName}) { // notes は書き出す順に並んでいる前提
  final fmt = DateFormat('yyyy-MM-dd HH:mm:ss');
  int? sec(int? ms) => ms == null ? null : ms ~/ 1000;
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
        n.inTrash ? 'ごみ箱' : '正常',
        n.folderId == null ? '' : (folderName?.call(n.folderId) ?? ''),
        n.starred ? '1' : '',
        sec(n.deletedAt),
        sec(n.reminderAt),
      ],
  ]);
}

enum ImportSource { backup, csv }

class ImportPlan { // 取り込み前の確認用。apply するまで DB は変えない
  final ImportSource source;
  final List<Note> notes; // 新しく追加するメモ（表示順どおり）
  final List<Folder> newFolders; // 取り込みのために新しく作るフォルダ
  final int skippedExisting; // 同じ ID のメモが既にあるため飛ばした件数
  final int skippedEmpty; // 本文が空のため飛ばした件数
  final bool? hashOk; // バックアップの破損チェック結果（CSV では null）
  final List<String> warnings; // 解析で気づいたこと（取り込み自体は続けられるもの）
  const ImportPlan(this.source, this.notes, this.skippedExisting, this.skippedEmpty,
      {this.newFolders = const [], this.hashOk, this.warnings = const []});

  int get coloredCount => notes.where((n) => n.textColor != null || n.bgColor != null).length;

  ImportPlan withoutColors() => ImportPlan( // 色を取り込まない（高速メモ帳は、画面で使っていない色の値を保存していることがあるため）
        source,
        [for (final n in notes) n.copyWith(textColor: () => null, bgColor: () => null)],
        skippedExisting,
        skippedEmpty,
        newFolders: newFolders,
        hashOk: hashOk,
        warnings: warnings,
      );
}

class ImportRecord { // 取り込み元を問わない1件分
  final String id; // 空や不正なら新しく振る
  final String body;
  final int? updatedUnix; // 秒
  final String? textColor, bgColor; // "#AARRGGBB"（正規化前）
  final String folderName; // 空なら「マイノート」
  final bool starred;
  final int? deletedUnix, reminderUnix; // 秒
  const ImportRecord({
    required this.id,
    required this.body,
    this.updatedUnix,
    this.textColor,
    this.bgColor,
    this.folderName = '',
    this.starred = false,
    this.deletedUnix,
    this.reminderUnix,
  });
}

ImportPlan planImport( // 中身を見てバックアップか CSV かを判断する
  String text, {
  required Set<String> existingIds,
  Map<String, String> existingFolders = const {}, // フォルダ名 → ID
  required int startOrder, // 追加するメモの最初の sort_order（既存メモの後ろに並べる）
  required int nowMs,
}) {
  if (looksLikeFastNoteBackup(text)) {
    final b = parseFastNoteBackup(text);
    final records = [
      for (final n in b.notes)
        ImportRecord(id: n.id, body: n.body, updatedUnix: n.updatedUnix, textColor: n.textColor, bgColor: n.bgColor),
    ];
    final p = _plan(records, existingIds: existingIds, existingFolders: existingFolders, startOrder: startOrder, nowMs: nowMs);
    return ImportPlan(ImportSource.backup, p.notes, p.skippedExisting, p.skippedEmpty,
        newFolders: p.newFolders, hashOk: b.hashOk, warnings: b.warnings);
  }
  return planCsvImport(text, existingIds: existingIds, existingFolders: existingFolders, startOrder: startOrder, nowMs: nowMs);
}

ImportPlan planCsvImport(
  String text, {
  required Set<String> existingIds,
  Map<String, String> existingFolders = const {},
  required int startOrder,
  required int nowMs,
}) {
  final rows = parseCsv(text);
  if (rows.isEmpty) throw const FormatException('ファイルが空です');
  final header = rows.first.map((h) => h.trim()).toList();
  int col(String name) => header.indexOf(name);
  final iBody = col('本文');
  if (iBody < 0) {
    throw const FormatException('高速メモ帳のバックアップでも、取り込める CSV でもありません（CSV に「本文」の列がありません）');
  }
  final iOrder = col('表示順'), iId = col('ID'), iUnix = col('更新日時UNIX'), iFg = col('文字色'), iBg = col('背景色');
  final iFolder = col('フォルダ'), iStar = col('☆'), iDeleted = col('削除日時UNIX'), iReminder = col('リマインダーUNIX');
  String cell(List<String> r, int i) => i >= 0 && i < r.length ? r[i] : '';
  int? intCell(List<String> r, int i) => int.tryParse(cell(r, i).trim());

  final indexed = rows.skip(1).indexed.toList(); // 表示順で並べ替える（同順位や不正値は元の行順）
  int orderOf((int, List<String>) e) => intCell(e.$2, iOrder) ?? (1 << 40) + e.$1;
  indexed.sort((a, b) {
    final c = orderOf(a).compareTo(orderOf(b));
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });

  final records = [
    for (final (_, r) in indexed)
      ImportRecord(
        id: cell(r, iId).trim(),
        body: cell(r, iBody),
        updatedUnix: intCell(r, iUnix),
        textColor: cell(r, iFg),
        bgColor: cell(r, iBg),
        folderName: cell(r, iFolder).trim(),
        starred: const {'1', '★', '☆', 'true', 'TRUE'}.contains(cell(r, iStar).trim()),
        deletedUnix: intCell(r, iDeleted),
        reminderUnix: intCell(r, iReminder),
      ),
  ];
  final p = _plan(records, existingIds: existingIds, existingFolders: existingFolders, startOrder: startOrder, nowMs: nowMs);
  return ImportPlan(ImportSource.csv, p.notes, p.skippedExisting, p.skippedEmpty, newFolders: p.newFolders);
}

({List<Note> notes, List<Folder> newFolders, int skippedExisting, int skippedEmpty}) _plan(
  List<ImportRecord> records, {
  required Set<String> existingIds,
  required Map<String, String> existingFolders,
  required int startOrder,
  required int nowMs,
}) {
  final notes = <Note>[];
  final newFolders = <Folder>[];
  final folderIds = {...existingFolders};
  final seen = <String>{...existingIds, ...existingFolders.values};
  var skippedExisting = 0, skippedEmpty = 0;

  String freshId() {
    String id;
    do {
      id = newNoteId();
    } while (seen.contains(id));
    seen.add(id);
    return id;
  }

  String? folderFor(String name) { // 同じ名前のフォルダがあればそこへ、無ければ作る
    if (name.isEmpty || isDefaultFolderName(name)) return null;
    return folderIds[name] ??= () {
      final f = Folder(id: freshId(), name: name, sortOrder: (1 << 20) + newFolders.length); // 既存フォルダの後ろに並ぶ
      newFolders.add(f);
      return f.id;
    }();
  }

  int? ms(int? sec) => sec != null && sec > 0 ? sec * 1000 : null;

  for (final r in records) {
    final body = r.body.replaceAll('\r\n', '\n').replaceAll('\r', '\n'); // 改行を LF に揃える
    if (body.trim().isEmpty) {
      skippedEmpty++;
      continue;
    }
    String id;
    if (_idRe.hasMatch(r.id)) {
      if (seen.contains(r.id)) { // 取り込み済み（同じファイルを2回取り込んでも増えない）
        skippedExisting++;
        continue;
      }
      id = r.id;
      seen.add(id);
    } else {
      id = freshId();
    }
    final updated = ms(r.updatedUnix) ?? nowMs;
    notes.add(Note(
      id: id,
      body: body,
      sortOrder: startOrder + notes.length,
      createdAt: updated, // 作成日時は元データに無いので更新日時で代用する
      updatedAt: updated,
      textColor: normalizeArgb(r.textColor, background: false),
      bgColor: normalizeArgb(r.bgColor, background: true),
      folderId: folderFor(r.folderName),
      starred: r.starred,
      deletedAt: ms(r.deletedUnix),
      reminderAt: ms(r.reminderUnix),
    ));
  }
  return (notes: notes, newFolders: newFolders, skippedExisting: skippedExisting, skippedEmpty: skippedEmpty);
}
