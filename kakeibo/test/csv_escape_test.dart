import 'package:flutter_test/flutter_test.dart';
import 'package:kakeibo/domain/usecases/expense/export_csv_usecase.dart';

void main() {
  test('普通の文字はそのまま', () {
    expect(escapeCsvCell('スーパー'), 'スーパー');
    expect(escapeCsvCell(''), '');
  });

  test('カンマ・引用符・改行（\\n と \\r）を含むと引用符で囲み、引用符は二重にする', () {
    expect(escapeCsvCell('a,b'), '"a,b"');
    expect(escapeCsvCell('He said "hi"'), '"He said ""hi"""');
    expect(escapeCsvCell('1行目\n2行目'), '"1行目\n2行目"');
    expect(escapeCsvCell('1行目\r2行目'), '"1行目\r2行目"');
  });

  test('数式として実行される先頭文字は「\'」を付けて無害化する（CSVインジェクション対策）', () {
    expect(escapeCsvCell('=HYPERLINK("http://example.com")'), '"\'=HYPERLINK(""http://example.com"")"');
    expect(escapeCsvCell('+1'), "'+1");
    expect(escapeCsvCell('-5'), "'-5");
    expect(escapeCsvCell('@SUM(A1)'), "'@SUM(A1)");
    expect(escapeCsvCell('\tTAB'), "'\tTAB");
    expect(escapeCsvCell('a=b'), 'a=b', reason: '途中の「=」は問題ない');
  });
}
