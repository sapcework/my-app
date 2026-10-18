import 'package:fastnote/core/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const lightSurface = Color(0xFFFFFBFF), lightOn = Color(0xFF1B1B1F);
  const darkSurface = Color(0xFF131316), darkOn = Color(0xFFE4E1E6);

  ({Color? bg, Color fg}) light(String? bg, String? fg) => noteColors(bg, fg, surface: lightSurface, onSurface: lightOn);
  ({Color? bg, Color fg}) dark(String? bg, String? fg) => noteColors(bg, fg, surface: darkSurface, onSurface: darkOn);

  group('noteColors：どんな値でも文字が読める', () {
    test('色なしならテーマの色', () {
      expect(light(null, null), (bg: null, fg: lightOn));
      expect(dark(null, null), (bg: null, fg: darkOn));
    });

    test('ほぼ透明な文字色は無いものとして扱う（不具合の再現：透けた文字＋薄い青の背景）', () {
      final c = light('#FFE3F2FD', '#1A2196F3');
      expect(c.bg, const Color(0xFFE3F2FD));
      expect(c.fg, Colors.black87, reason: '背景色付きの既定の文字色');
      expect(contrastRatio(Color.alphaBlend(c.fg, c.bg!), c.bg!), greaterThanOrEqualTo(minContrast));
    });

    test('薄い青の背景に白い文字は、読める黒に置き換える', () {
      expect(light('#FFE3F2FD', '#FFFFFFFF').fg, Colors.black87);
    });

    test('背景なしで地の色と同じ文字色は置き換える（白地に白・ダークの黒地に黒）', () {
      expect(light(null, '#FFFFFFFF').fg, Colors.black87);
      expect(dark(null, '#FF000000').fg, Colors.white);
    });

    test('ほぼ透明な背景は無いものとして扱う', () {
      expect(light('#10FF0000', null), (bg: null, fg: lightOn));
    });

    test('読める組み合わせはそのまま（ユーザーが選んだ色を勝手に変えない）', () {
      expect(light('#FFFFF3B0', '#FFD32F2F'), (bg: const Color(0xFFFFF3B0), fg: const Color(0xFFD32F2F)));
      expect(light(null, '#FF1976D2').fg, const Color(0xFF1976D2));
      expect(dark('#FFD6E8FF', null).fg, Colors.black87, reason: 'ダークでも背景色付きなら黒い文字');
    });

    test('どの組み合わせでもコントラスト比 3:1 以上になる', () {
      const samples = [null, '#00FF0000', '#1A000000', '#80FFFFFF', '#FFFFFFFF', '#FF000000', '#FFE3F2FD', '#FF2196F3', '#FFFFF3B0', '#FF616161'];
      for (final (surface, on) in [(lightSurface, lightOn), (darkSurface, darkOn)]) {
        for (final bg in samples) {
          for (final fg in samples) {
            final c = noteColors(bg, fg, surface: surface, onSurface: on);
            final ground = c.bg == null ? surface : Color.alphaBlend(c.bg!, surface);
            expect(contrastRatio(Color.alphaBlend(c.fg, ground), ground), greaterThanOrEqualTo(minContrast), reason: '背景 $bg・文字 $fg・地 $surface');
          }
        }
      }
    });
  });

  group('normalizeArgb：取り込み時に「色なし」とする値', () {
    test('文字色は不透明さが半分未満なら色なし', () {
      expect(normalizeArgb('#00FF0000', background: false), isNull);
      expect(normalizeArgb('#10FF0000', background: false), isNull);
      expect(normalizeArgb('#7FFF0000', background: false), isNull);
      expect(normalizeArgb('#80FF0000', background: false), '#80FF0000');
      expect(normalizeArgb('#ffd32f2f', background: false), '#FFD32F2F', reason: '大文字にそろえる');
    });

    test('背景は透明に近いものと白が色なし', () {
      expect(normalizeArgb('#1FE3F2FD', background: true), isNull);
      expect(normalizeArgb('#FFFFFFFF', background: true), isNull);
      expect(normalizeArgb('#FFE3F2FD', background: true), '#FFE3F2FD');
    });

    test('形式が違う値は色なし', () {
      expect(normalizeArgb('red', background: false), isNull);
      expect(normalizeArgb('', background: true), isNull);
    });
  });
}
