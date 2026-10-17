import 'package:flutter/material.dart';

import '../../core/colors.dart';

// メモの色を選ぶボトムシート。選ぶたびに onChanged を呼び、その場で反映する
Future<void> showColorSheet(
  BuildContext context, {
  required String? bg,
  required String? fg,
  required void Function(String? bg, String? fg) onChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => StatefulBuilder(builder: (context, setState) {
      Widget swatches(List<String?> palette, String? selected, bool background, void Function(String?) pick) => Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final c in palette)
                _Swatch(
                  color: parseArgb(c),
                  background: background,
                  selected: c == selected || (c == null && selected == null),
                  onTap: () => setState(() => pick(c)),
                ),
              if (selected != null && !palette.contains(selected)) // 取り込んだメモの独自の色も選択中として見せる
                _Swatch(color: parseArgb(selected), background: background, selected: true, onTap: () {}),
            ],
          );

      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('背景色', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 10),
              swatches(noteBgPalette, bg, true, (c) {
                bg = c;
                onChanged(bg, fg);
              }),
              const SizedBox(height: 20),
              Text('文字色', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 10),
              swatches(noteTextPalette, fg, false, (c) {
                fg = c;
                onChanged(bg, fg);
              }),
            ],
          ),
        ),
      );
    }),
  );
}

class _Swatch extends StatelessWidget {
  final Color? color; // null は既定
  final bool background, selected;
  final VoidCallback onTap;
  const _Swatch({required this.color, required this.background, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      selected: selected,
      label: color == null ? '既定の色' : null,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: background ? (color ?? cs.surface) : cs.surfaceContainerHighest,
            border: Border.all(color: selected ? cs.primary : cs.outlineVariant, width: selected ? 3 : 1),
          ),
          alignment: Alignment.center,
          child: background
              ? (color == null ? Icon(Icons.format_color_reset, size: 20, color: cs.onSurfaceVariant) : null)
              : Text('あ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color ?? cs.onSurface)),
        ),
      ),
    );
  }
}
