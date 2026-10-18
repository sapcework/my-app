import 'package:flutter/material.dart';

const contentMaxWidth = 720.0; // タブレットや横向きで、1行が長くなりすぎて読みにくくならない幅

// 中身を最大幅に収めて中央に置く（スマホでは何も変わらない）
class MaxWidth extends StatelessWidget {
  final Widget child;
  const MaxWidth({super.key, required this.child});

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: contentMaxWidth), child: child),
      );
}
