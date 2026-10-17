import 'package:flutter/material.dart';

// 数字のテンキー。length を指定するとその桁数で自動送信し、指定しなければ OK ボタンで送信する
class PinPad extends StatefulWidget {
  final ValueChanged<String> onSubmit;
  final int? length; // 解除時は設定した桁数（そろった時点で照合）
  final int minLength, maxLength;
  final bool enabled;

  const PinPad({super.key, required this.onSubmit, this.length, this.minLength = 4, this.maxLength = 8, this.enabled = true});

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _pin = '';

  int get _max => widget.length ?? widget.maxLength;

  void _digit(String d) {
    if (!widget.enabled || _pin.length >= _max) return;
    setState(() => _pin += d);
    if (widget.length != null && _pin.length == widget.length) _submit();
  }

  void _submit() {
    if (_pin.length < widget.minLength) return;
    final pin = _pin;
    Future.microtask(() { // 最後の●を描いてから送る
      if (mounted) setState(() => _pin = '');
      widget.onSubmit(pin);
    });
  }

  void _backspace() {
    if (_pin.isNotEmpty) setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dots = widget.length ?? (_pin.length < widget.minLength ? widget.minLength : _pin.length); // 自由桁数なら入力に合わせて増やす
    Widget key(String label, {VoidCallback? onTap, Widget? child}) => Padding(
          padding: const EdgeInsets.all(6),
          child: SizedBox(
            width: 76,
            height: 60,
            child: FilledButton.tonal(
              onPressed: widget.enabled ? onTap : null,
              style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: EdgeInsets.zero),
              child: child ?? Text(label, style: Theme.of(context).textTheme.titleLarge),
            ),
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(dots, (i) {
            final filled = i < _pin.length;
            return Container(
              width: 14,
              height: 14,
              margin: const EdgeInsets.symmetric(horizontal: 7),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? cs.primary : null,
                border: Border.all(color: filled ? cs.primary : cs.outline, width: 1.5),
              ),
            );
          }),
        ),
        const SizedBox(height: 24),
        for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']])
          Row(mainAxisSize: MainAxisSize.min, children: [for (final d in row) key(d, onTap: () => _digit(d))]),
        Row(mainAxisSize: MainAxisSize.min, children: [
          key('', onTap: _backspace, child: const Icon(Icons.backspace_outlined, semanticLabel: '1文字消す')),
          key('0', onTap: () => _digit('0')),
          widget.length == null
              ? key('OK', onTap: _pin.length >= widget.minLength ? _submit : null)
              : const SizedBox(width: 88, height: 72),
        ]),
      ],
    );
  }
}
