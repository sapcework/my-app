// アイコンの原本（icon/*.svg）から Android 用の PNG を作る。アイコンを変えたらこれを実行する:
//   flutter test icon/render_icons_test.dart
// Pillow などの外部ツールを使わず、Flutter の描画で PNG にしている
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

const _res = 'android/app/src/main/res';
const _densities = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0};
const background = Color(0xFF6D7CF2); // values/ic_launcher_background.xml と同じ色

Future<ui.Picture> _svg(String name) async => (await vg.loadPicture(SvgStringLoader(File('icon/$name.svg').readAsStringSync()), null)).picture;

Future<void> _png(String path, int size, void Function(Canvas c, double scale) paint) async {
  final rec = ui.PictureRecorder();
  paint(Canvas(rec), size / 108); // 原本は 108x108 の座標
  final img = await rec.endRecording().toImage(size, size);
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  File(path)
    ..createSync(recursive: true)
    ..writeAsBytesSync(bytes!.buffer.asUint8List());
}

void main() {
  testWidgets('アイコンの PNG を作る', (tester) async {
    await tester.runAsync(() async {
      final fg = await _svg('foreground'), mono = await _svg('monochrome'), legacy = await _svg('legacy');
      void draw(Canvas c, double s, ui.Picture p) => c
        ..scale(s)
        ..drawPicture(p);

      for (final MapEntry(key: d, value: k) in _densities.entries) {
        final adaptive = (108 * k).round(); // アダプティブアイコンの各層は 108dp
        await _png('$_res/mipmap-$d/ic_launcher_foreground.png', adaptive, (c, s) => draw(c, s, fg));
        await _png('$_res/mipmap-$d/ic_launcher_monochrome.png', adaptive, (c, s) => draw(c, s, mono));
        await _png('$_res/mipmap-$d/ic_launcher.png', (48 * k).round(), (c, s) => draw(c, s, legacy)); // 旧形式は 48dp
      }
      await _png('assets/icon/app_icon.png', 192, (c, s) => draw(c, s, legacy)); // アプリ内（FastNote について）用

      // 確認用のプレビュー（コミットしない）。端末が切り抜く形を再現する
      Future<void> preview(String name, int size, Path Function(double size) shape) => _png('build/icon_preview/$name.png', size, (c, _) {
            c.clipPath(shape(size.toDouble()));
            c.drawColor(background, BlendMode.src);
            c.scale(size / 72); // ランチャーは 108dp のうち中央の 72dp を見せる
            c.translate(-18, -18);
            c.drawPicture(fg);
          });
      await preview('circle', 192, (n) => Path()..addOval(Rect.fromLTWH(0, 0, n, n)));
      await preview('rounded', 192, (n) => Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, n, n), Radius.circular(n * 0.22))));
      await preview('circle_48', 48, (n) => Path()..addOval(Rect.fromLTWH(0, 0, n, n)));
      await _png('build/icon_preview/legacy_48.png', 48, (c, s) => draw(c, s, legacy));
      await _png('build/icon_preview/monochrome.png', 192, (c, _) { // テーマアイコンは端末が単色版を塗り直す（ここでは濃い緑の背景に淡い色で再現）
        c.clipPath(Path()..addOval(const Rect.fromLTWH(0, 0, 192, 192)));
        c.drawColor(const Color(0xFF29473A), BlendMode.src);
        c.scale(192 / 72);
        c.translate(-18, -18);
        c.saveLayer(null, Paint()..colorFilter = const ColorFilter.mode(Color(0xFFC6EBD6), BlendMode.srcIn));
        c.drawPicture(mono);
        c.restore();
      });
    });
  });
}
