import 'package:flutter/material.dart';

// 4桁PIN入力用テンキーUI（Web版 PinPad.tsx に対応）
// 4桁入力し終えると onCompleted を呼び、入力をクリアする
class PinPad extends StatefulWidget {
  final ValueChanged<String> onCompleted;
  const PinPad({super.key, required this.onCompleted});

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _pin = '';

  void _pressDigit(String digit) {
    if (_pin.length >= 4) return;
    setState(() => _pin = _pin + digit);
    if (_pin.length == 4) {
      final pin = _pin;
      Future.microtask(() { // ドット4つの表示を描画してからコールバック
        if (mounted) setState(() => _pin = '');
        widget.onCompleted(pin);
      });
    }
  }

  void _backspace() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 入力状態ドット表示
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(4, (i) {
            final filled = i < _pin.length;
            return Container(
              width: 14,
              height: 14,
              margin: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? colorScheme.primary : null,
                border: Border.all(
                  color: filled ? colorScheme.primary : colorScheme.outline,
                  width: 1.5,
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 24),
        // テンキー（1〜9 / 空白・0・バックスペース）
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['', '0', '<'],
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: row.map((key) {
                if (key.isEmpty) {
                  return const SizedBox(width: 72, height: 60);
                }
                final isBackspace = key == '<';
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: SizedBox(
                    width: 72,
                    height: 60,
                    child: isBackspace
                        ? IconButton(
                            onPressed: _backspace,
                            icon: const Icon(Icons.backspace_outlined),
                          )
                        : FilledButton.tonal(
                            onPressed: () => _pressDigit(key),
                            style: FilledButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: Text(key,
                                style: Theme.of(context).textTheme.titleLarge),
                          ),
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }
}
