// RFC 4180 の CSV 読み書き（引用符内の改行・二重引用符に対応）

List<List<String>> parseCsv(String text) {
  final s = text.startsWith('﻿') ? text.substring(1) : text; // BOM を除く
  final rows = <List<String>>[];
  var row = <String>[];
  final field = StringBuffer();
  var inQuotes = false;
  var fieldStarted = false; // 空行と「空フィールド1つの行」を区別する
  var i = 0;

  void endField() {
    row.add(field.toString());
    field.clear();
  }

  void endRow() {
    endField();
    if (!(row.length == 1 && row[0].isEmpty && !fieldStarted)) rows.add(row); // 空行は捨てる
    row = <String>[];
    fieldStarted = false;
  }

  while (i < s.length) {
    final c = s[i];
    if (inQuotes) {
      if (c == '"') {
        if (i + 1 < s.length && s[i + 1] == '"') { // "" は " 1文字
          field.write('"');
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field.write(c);
      }
      i++;
      continue;
    }
    switch (c) {
      case '"':
        inQuotes = true;
        fieldStarted = true;
      case ',':
        endField();
        fieldStarted = true;
      case '\r':
        endRow();
        if (i + 1 < s.length && s[i + 1] == '\n') i++; // CRLF
      case '\n':
        endRow();
      default:
        field.write(c);
        fieldStarted = true;
    }
    i++;
  }
  if (inQuotes) throw const FormatException('CSV の引用符が閉じられていません（ファイルが途中で切れている可能性があります）');
  if (fieldStarted || field.isNotEmpty || row.isNotEmpty) endRow();
  return rows;
}

String buildCsv(List<List<Object?>> rows) { // BOM 付き・CRLF・全フィールドを引用符で囲む（Excel で開ける形）
  String q(Object? v) => '"${(v ?? '').toString().replaceAll('"', '""')}"';
  return '﻿${rows.map((r) => r.map(q).join(',')).join('\r\n')}\r\n';
}
