import 'package:flutter/material.dart';

// メモの色は高速メモ帳と同じ "#AARRGGBB" 文字列で保存する（CSV でそのまま往復できるように）

final _argbRe = RegExp(r'^#[0-9A-Fa-f]{8}$');

Color? parseArgb(String? s) { // 不正な値や null は既定色（null）として扱う
  if (s == null || !_argbRe.hasMatch(s)) return null;
  return Color(int.parse(s.substring(1), radix: 16));
}

String toArgb(Color c) => '#${c.toARGB32().toRadixString(16).padLeft(8, '0').toUpperCase()}';

const minTextAlpha = 0x80; // これより透けている文字色は「色なし」（高速メモ帳の文字色の初期値 #00FF0000 など）
const minBgAlpha = 0x20; // これより透けている背景色は「背景なし」
const minContrast = 3.0; // 文字と地の色のコントラスト比の下限（WCAG の大きな文字の基準）

String? normalizeArgb(String? s, {required bool background}) { // 取り込み時の正規化。既定色に当たるものは null にする
  if (s == null) return null;
  final v = s.trim().toUpperCase();
  if (!_argbRe.hasMatch(v)) return null;
  final alpha = int.parse(v.substring(1, 3), radix: 16);
  if (alpha < (background ? minBgAlpha : minTextAlpha)) return null; // 透けている色は高速メモ帳でも見えないので「色なし」
  if (background && v == '#FFFFFFFF') return null; // 白背景は既定（ダークモードでは暗い背景にしたいので）
  return v;
}

double contrastRatio(Color a, Color b) { // WCAG のコントラスト比（1〜21）
  final la = a.computeLuminance(), lb = b.computeLuminance();
  return (la > lb ? la + 0.05 : lb + 0.05) / (la > lb ? lb + 0.05 : la + 0.05);
}

const noteBgPalette = <String?>[ // 背景色の選択肢（null は既定）
  null,
  '#FFFFF3B0', // 黄
  '#FFFFE0C2', // 橙
  '#FFFFD6D6', // 赤
  '#FFFFDDEE', // 桃
  '#FFEBDDFF', // 紫
  '#FFD6E8FF', // 青
  '#FFD7F5DD', // 緑
  '#FFE6E6E6', // 灰
];

const noteTextPalette = <String?>[ // 文字色の選択肢（null は既定）
  null,
  '#FFD32F2F', // 赤
  '#FFF57C00', // 橙
  '#FF388E3C', // 緑
  '#FF1976D2', // 青
  '#FF7B1FA2', // 紫
  '#FF616161', // 灰
];

// 実際に描く色。どんな値が保存されていても文字が読めるようにする（取り込んだデータに想定外の色が入っていても見えなくならないように）
//   surface: 背景色が無いときの地の色 / onSurface: 色が無いときの文字色（どちらもテーマの色）
({Color? bg, Color fg}) noteColors(String? bgArgb, String? textArgb, {required Color surface, required Color onSurface}) {
  var bg = parseArgb(bgArgb);
  if (bg != null && (bg.a * 255).round() < minBgAlpha) bg = null; // ほぼ透明な背景は無いものとする
  final ground = bg == null ? surface : Color.alphaBlend(bg, surface); // 実際に見える地の色

  var fg = parseArgb(textArgb);
  if (fg != null && (fg.a * 255).round() < minTextAlpha) fg = null; // ほぼ透明な文字色は無いものとする
  fg ??= bg != null ? Colors.black87 : onSurface; // 背景色付きなら既定の文字色は黒（ダークモードでも読めるように）

  if (contrastRatio(Color.alphaBlend(fg, ground), ground) < minContrast) { // 地の色と近すぎて読めないときは黒か白に
    fg = contrastRatio(Colors.black, ground) >= contrastRatio(Colors.white, ground) ? Colors.black87 : Colors.white;
  }
  return (bg: bg, fg: fg);
}
