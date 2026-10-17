import 'dart:io';

import 'package:fastnote/state/json_file.dart';
import 'package:fastnote/state/settings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late Directory dir;
  late File file;

  setUp(() {
    dir = Directory.systemTemp.createTempSync('fastnote_settings');
    file = File('${dir.path}/settings.json');
  });

  tearDown(() => dir.deleteSync(recursive: true));

  test('初めて起動したときは、一覧の見出しが明細より大きく、行間と文字間は詰めた値', () async {
    final s = SettingsController(JsonFile(file));
    await s.load();
    expect(s.listFontSize, greaterThan(s.detailFontSize));
    expect(s.lineHeight, lessThan(1.5));
    expect(s.letterSpacing, lessThan(0));
  });

  test('旧版の文字サイズ（共通の1つ）は、明細にそのまま、一覧には少し大きくして引き継ぐ', () async {
    file.writeAsStringSync('{"sort":"manual","fontSize":20}');
    final s = SettingsController(JsonFile(file));
    await s.load();
    expect([s.detailFontSize, s.listFontSize], [20, 22]);
    expect(s.sort, SortMode.updatedDesc, reason: '廃止した「手動」は更新順にする');
  });

  test('変更は保存され、範囲外の値は丸める。初期値に戻せる', () async {
    final a = SettingsController(JsonFile(file));
    await a.load();
    await a.setLineHeight(1.234);
    await a.setLetterSpacing(-5);
    await a.setListFontSize(99);
    await a.setDetailPadding(0);
    final b = SettingsController(JsonFile(file));
    await b.load();
    expect([b.lineHeight, b.letterSpacing, b.listFontSize, b.detailPadding], [1.25, SettingsController.minLetterSpacing, SettingsController.maxFontSize, 0]);
    await b.resetTextLayout();
    expect(b.detailPadding, SettingsController.defaultPadding);
    expect([b.listFontSize, b.detailFontSize, b.lineHeight, b.letterSpacing], [
      SettingsController.defaultListFontSize,
      SettingsController.defaultDetailFontSize,
      SettingsController.defaultLineHeight,
      SettingsController.defaultLetterSpacing,
    ]);
  });
}
