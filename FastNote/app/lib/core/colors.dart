import 'package:flutter/material.dart';

// メモの色は高速メモ帳と同じ "#AARRGGBB" 文字列で保存する（CSV でそのまま往復できるように）

final _argbRe = RegExp(r'^#[0-9A-Fa-f]{8}$');

Color? parseArgb(String? s) { // 不正な値や null は既定色（null）として扱う
  if (s == null || !_argbRe.hasMatch(s)) return null;
  return Color(int.parse(s.substring(1), radix: 16));
}

String toArgb(Color c) => '#${c.toARGB32().toRadixString(16).padLeft(8, '0').toUpperCase()}';

String? normalizeArgb(String? s, {required bool background}) { // 取り込み時の正規化。既定色に当たるものは null にする
  if (s == null) return null;
  final v = s.trim().toUpperCase();
  if (!_argbRe.hasMatch(v)) return null;
  if (v.startsWith('#00')) return null; // 透明＝高速メモ帳で「色なし」（文字色の初期値 #00FF0000 がこれ）
  if (background && v == '#FFFFFFFF') return null; // 白背景は既定（ダークモードでは暗い背景にしたいので）
  return v;
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

({Color? bg, Color? fg}) noteColors(String? bgArgb, String? textArgb) { // 実際に描く色。背景色付きなら既定の文字色は黒（ダークモードでも読めるように）
  final bg = parseArgb(bgArgb);
  final fg = parseArgb(textArgb) ?? (bg != null ? Colors.black87 : null);
  return (bg: bg, fg: fg);
}
