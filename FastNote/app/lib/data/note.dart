import 'dart:math';

// メモ1件。タイトルは持たず、本文の1行目をタイトルとして扱う（高速メモ帳と同じ）
class Note {
  final String id;
  final String body;
  final int sortOrder; // 取り込んだときの順（同じ更新日時どうしの並びに使う）
  final int createdAt; // 作成日時（UNIX ミリ秒）
  final int updatedAt; // 更新日時（UNIX ミリ秒）
  final String? textColor; // "#AARRGGBB"。null は既定色
  final String? bgColor; // "#AARRGGBB"。null は既定色
  final String? folderId; // null は「私のノート」
  final bool starred; // ☆。一覧の先頭に固定する
  final int? deletedAt; // ごみ箱に入れた日時（UNIX ミリ秒）。null なら通常のメモ
  final int? reminderAt; // リマインダーの日時（UNIX ミリ秒）

  const Note({
    required this.id,
    required this.body,
    required this.sortOrder,
    required this.createdAt,
    required this.updatedAt,
    this.textColor,
    this.bgColor,
    this.folderId,
    this.starred = false,
    this.deletedAt,
    this.reminderAt,
  });

  bool get inTrash => deletedAt != null;

  String get title { // 最初の空でない行
    for (final line in body.split('\n')) {
      final t = line.trim();
      if (t.isNotEmpty) return t;
    }
    return '';
  }

  Note copyWith({
    String? body,
    int? sortOrder,
    int? updatedAt,
    String? Function()? textColor, // null を設定できるように関数で受け取る
    String? Function()? bgColor,
    String? Function()? folderId,
    bool? starred,
    int? Function()? deletedAt,
    int? Function()? reminderAt,
  }) =>
      Note(
        id: id,
        body: body ?? this.body,
        sortOrder: sortOrder ?? this.sortOrder,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        textColor: textColor != null ? textColor() : this.textColor,
        bgColor: bgColor != null ? bgColor() : this.bgColor,
        folderId: folderId != null ? folderId() : this.folderId,
        starred: starred ?? this.starred,
        deletedAt: deletedAt != null ? deletedAt() : this.deletedAt,
        reminderAt: reminderAt != null ? reminderAt() : this.reminderAt,
      );

  Map<String, Object?> toMap() => {
        'id': id,
        'body': body,
        'sort_order': sortOrder,
        'created_at': createdAt,
        'updated_at': updatedAt,
        'text_color': textColor,
        'bg_color': bgColor,
        'folder_id': folderId,
        'starred': starred ? 1 : 0,
        'deleted_at': deletedAt,
        'reminder_at': reminderAt,
      };

  factory Note.fromMap(Map<String, Object?> m) => Note(
        id: m['id'] as String,
        body: m['body'] as String,
        sortOrder: m['sort_order'] as int,
        createdAt: m['created_at'] as int,
        updatedAt: m['updated_at'] as int,
        textColor: m['text_color'] as String?,
        bgColor: m['bg_color'] as String?,
        folderId: m['folder_id'] as String?,
        starred: (m['starred'] as int? ?? 0) != 0,
        deletedAt: m['deleted_at'] as int?,
        reminderAt: m['reminder_at'] as int?,
      );
}

class Folder {
  final String id;
  final String name;
  final int sortOrder; // 横メニューでの並び
  const Folder({required this.id, required this.name, required this.sortOrder});

  Folder copyWith({String? name, int? sortOrder}) => Folder(id: id, name: name ?? this.name, sortOrder: sortOrder ?? this.sortOrder);

  Map<String, Object?> toMap() => {'id': id, 'name': name, 'sort_order': sortOrder};

  factory Folder.fromMap(Map<String, Object?> m) => Folder(id: m['id'] as String, name: m['name'] as String, sortOrder: m['sort_order'] as int);
}

const defaultFolderName = '私のノート'; // folderId が null のメモの入れ物（高速メモ帳と同じ名前）

final _idRand = Random.secure();
const _idChars = '0123456789abcdefghijklmnopqrstuvwxyz';

String newNoteId() => List.generate(16, (_) => _idChars[_idRand.nextInt(_idChars.length)]).join(); // 高速メモ帳と同じ16桁の英小文字・数字
