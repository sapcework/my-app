// アイコンの原本（icon/*.svg）から Android・Windows 用のアイコンを作る。アイコンを変えたらこれを実行する:
//   flutter test icon/render_icons_test.dart
// Pillow などの外部ツールを使わず、Flutter の描画で PNG にしている（FastNote と同じ仕組み）
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

const _res = 'android/app/src/main/res';
const _densities = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0};
const _icoSizes = [16, 24, 32, 48, 64, 128, 256]; // Windows がタスクバー・エクスプローラーなどで使い分ける大きさ

Future<ui.Picture> _svg(String name) async => (await vg.loadPicture(SvgStringLoader(File('icon/$name.svg').readAsStringSync()), null)).picture;

Future<Uint8List> _render(int size, void Function(Canvas c, double scale) paint) async {
  final rec = ui.PictureRecorder();
  paint(Canvas(rec), size / 108); // 原本は 108x108 の座標
  final img = await rec.endRecording().toImage(size, size);
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  return bytes!.buffer.asUint8List();
}

Future<void> _png(String path, int size, void Function(Canvas c, double scale) paint) async {
  final bytes = await _render(size, paint);
  File(path)
    ..createSync(recursive: true)
    ..writeAsBytesSync(bytes);
}

// PNG をそのまま入れた ICO を作る（Windows Vista 以降はこの形式を読める）
Uint8List _ico(List<(int size, Uint8List png)> images) {
  final out = BytesBuilder();
  final header = ByteData(6)
    ..setUint16(2, 1, Endian.little) // 種類：アイコン
    ..setUint16(4, images.length, Endian.little);
  out.add(header.buffer.asUint8List());
  var offset = 6 + 16 * images.length;
  for (final (size, png) in images) {
    final entry = ByteData(16)
      ..setUint8(0, size >= 256 ? 0 : size) // 256 は 0 と書く決まり
      ..setUint8(1, size >= 256 ? 0 : size)
      ..setUint16(4, 1, Endian.little) // プレーン数
      ..setUint16(6, 32, Endian.little) // 色深度
      ..setUint32(8, png.length, Endian.little)
      ..setUint32(12, offset, Endian.little);
    out.add(entry.buffer.asUint8List());
    offset += png.length;
  }
  for (final (_, png) in images) {
    out.add(png);
  }
  return out.toBytes();
}

void main() {
  testWidgets('アイコンの PNG を作る', (tester) async {
    await tester.runAsync(() async {
      final bg = await _svg('background'), fg = await _svg('foreground'), mono = await _svg('monochrome'), legacy = await _svg('legacy');
      void draw(Canvas c, double s, ui.Picture p) => c
        ..scale(s)
        ..drawPicture(p);

      for (final MapEntry(key: d, value: k) in _densities.entries) {
        final adaptive = (108 * k).round(); // アダプティブアイコンの各層は 108dp
        await _png('$_res/mipmap-$d/ic_launcher_background.png', adaptive, (c, s) => draw(c, s, bg));
        await _png('$_res/mipmap-$d/ic_launcher_foreground.png', adaptive, (c, s) => draw(c, s, fg));
        await _png('$_res/mipmap-$d/ic_launcher_monochrome.png', adaptive, (c, s) => draw(c, s, mono));
        await _png('$_res/mipmap-$d/ic_launcher.png', (48 * k).round(), (c, s) => draw(c, s, legacy)); // 旧形式は 48dp
      }
      await _png('assets/icon/app_icon.png', 512, (c, s) => draw(c, s, legacy)); // アプリ内（家計簿について）用。72dp を高解像度の端末でもぼやけずに出せる大きさ

      final icoImages = <(int, Uint8List)>[
        for (final size in _icoSizes) (size, await _render(size, (c, s) => draw(c, s, legacy))),
      ];
      File('windows/runner/resources/app_icon.ico').writeAsBytesSync(_ico(icoImages));

      // 確認用のプレビュー（コミットしない）。端末が切り抜く形を再現する
      Future<void> preview(String name, int size, Path Function(double size) shape) => _png('build/icon_preview/$name.png', size, (c, _) {
            c.clipPath(shape(size.toDouble()));
            c.scale(size / 72); // ランチャーは 108dp のうち中央の 72dp を見せる
            c.translate(-18, -18);
            c.drawPicture(bg);
            c.drawPicture(fg);
          });
      await preview('circle', 192, (n) => Path()..addOval(Rect.fromLTWH(0, 0, n, n)));
      await preview('rounded', 192, (n) => Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, n, n), Radius.circular(n * 0.22))));
      await preview('large', 1024, (n) => Path()..addRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, n, n), Radius.circular(n * 0.22)))); // 細部の確認用
      await preview('circle_48', 48, (n) => Path()..addOval(Rect.fromLTWH(0, 0, n, n)));
      await _png('build/icon_preview/legacy_48.png', 48, (c, s) => draw(c, s, legacy));
      await _png('build/icon_preview/monochrome.png', 192, (c, _) { // テーマアイコンは端末が単色版を塗り直す（ここでは濃い紺の背景に淡い色で再現）
        c.clipPath(Path()..addOval(const Rect.fromLTWH(0, 0, 192, 192)));
        c.drawColor(const Color(0xFF283593), BlendMode.src);
        c.scale(192 / 72);
        c.translate(-18, -18);
        c.saveLayer(null, Paint()..colorFilter = const ColorFilter.mode(Color(0xFFD6DBF5), BlendMode.srcIn));
        c.drawPicture(mono);
        c.restore();
      });
    });
  });
}
