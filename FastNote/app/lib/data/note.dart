import 'dart:math';

// メモ1件。タイトルは持たず、本文の1行目をタイトルとして扱う（高速メモ帳と同じ）
class Note {
  final String id;
  final String body;
  final int sortOrder; // 手動並べ替えの順（小さいほど上）
  final int createdAt; // 作成日時（UNIX ミリ秒）
  final int updatedAt; // 更新日時（UNIX ミリ秒）
  final String? textColor; // "#AARRGGBB"。null は既定色
  final String? bgColor; // "#AARRGGBB"。null は既定色

  const Note({
    required this.id,
    required this.body,
    required this.sortOrder,
    required this.createdAt,
    required this.updatedAt,
    this.textColor,
    this.bgColor,
  });

  String get title { // 最初の空でない行
    for (final line in body.split('\n')) {
      final t = line.trim();
      if (t.isNotEmpty) return t;
    }
    return '';
  }

  String get preview { // 一覧に出す2行目以降の抜粋
    final lines = body.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    return lines.length <= 1 ? '' : lines.skip(1).join(' ');
  }

  Note copyWith({
    String? body,
    int? sortOrder,
    int? updatedAt,
    String? Function()? textColor, // null を設定できるように関数で受け取る
    String? Function()? bgColor,
  }) =>
      Note(
        id: id,
        body: body ?? this.body,
        sortOrder: sortOrder ?? this.sortOrder,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        textColor: textColor != null ? textColor() : this.textColor,
        bgColor: bgColor != null ? bgColor() : this.bgColor,
      );

  Map<String, Object?> toMap() => {
        'id': id,
        'body': body,
        'sort_order': sortOrder,
        'created_at': createdAt,
        'updated_at': updatedAt,
        'text_color': textColor,
        'bg_color': bgColor,
      };

  factory Note.fromMap(Map<String, Object?> m) => Note(
        id: m['id'] as String,
        body: m['body'] as String,
        sortOrder: m['sort_order'] as int,
        createdAt: m['created_at'] as int,
        updatedAt: m['updated_at'] as int,
        textColor: m['text_color'] as String?,
        bgColor: m['bg_color'] as String?,
      );
}

final _idRand = Random.secure();
const _idChars = '0123456789abcdefghijklmnopqrstuvwxyz';

String newNoteId() => List.generate(16, (_) => _idChars[_idRand.nextInt(_idChars.length)]).join(); // 高速メモ帳と同じ16桁の英小文字・数字
