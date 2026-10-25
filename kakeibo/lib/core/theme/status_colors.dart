import 'package:flutter/material.dart';

// 予算の「超過／残り」や前月比の「増／減」に使う色。ライトは淡い背景に濃い文字、ダークは暗い背景に明るい文字にする
// （以前は Colors.red.shade50 などライト用の色を直書きしていて、ダークモードで白く浮いていた）
class StatusColors {
  final Color background;
  final Color foreground; // 文字
  final Color icon;
  const StatusColors._(this.background, this.foreground, this.icon);

  static StatusColors of(BuildContext context, {required bool danger}) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final MaterialColor c = danger ? Colors.red : Colors.green;
    return dark
        ? StatusColors._(c.shade900.withValues(alpha: 0.45), c.shade200, c.shade300)
        : StatusColors._(c.shade50, c.shade700, c.shade600);
  }
}

// 設定画面などの丸いアイコン枠の色。ライトはWeb版と同じ淡い背景、ダークは元の色を薄く敷いて明るめのアイコンにする
(Color background, Color icon) tonalIconColors(BuildContext context, {required Color lightBackground, required Color color}) {
  if (Theme.of(context).brightness == Brightness.light) return (lightBackground, color);
  return (color.withValues(alpha: 0.22), Color.lerp(color, Colors.white, 0.35)!);
}
