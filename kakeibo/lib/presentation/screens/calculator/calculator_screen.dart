import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class CalculatorScreen extends StatefulWidget {
  final double? initialValue;
  const CalculatorScreen({super.key, this.initialValue});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  String _display = '0';       // 現在入力中の数値
  String _expression = '';     // 式（例: "500 + 300 + "）
  double _previousValue = 0;
  String? _pendingOperator;
  bool _clearOnNextInput = false; // 演算子後の次入力で画面をクリア

  @override
  void initState() {
    super.initState();
    if (widget.initialValue != null && widget.initialValue! > 0) {
      _display = _formatDisplay(widget.initialValue!);
      _previousValue = widget.initialValue!;
    }
  }

  String _formatDisplay(double value) {
    if (value == value.truncateToDouble()) return value.toInt().toString();
    return value.toStringAsFixed(2).replaceAll(RegExp(r'\.?0+$'), '');
  }

  void _pressDigit(String digit) {
    setState(() {
      if (_clearOnNextInput) {
        _display = digit == '.' ? '0.' : digit;
        _clearOnNextInput = false;
      } else if (_display == '0' && digit != '.') {
        _display = digit;
      } else if (digit == '.' && _display.contains('.')) {
        return; // 小数点は1個まで
      } else if (_display.length >= 12) {
        return; // 桁数制限
      } else {
        _display = _display + digit;
      }
    });
  }

  void _pressOperator(String op) {
    setState(() {
      final current = double.tryParse(_display) ?? 0;
      if (_pendingOperator != null && !_clearOnNextInput) {
        final result = _calculate(_previousValue, current, _pendingOperator!);
        _expression = '${_formatDisplay(result)} $op ';
        _previousValue = result;
        _display = _formatDisplay(result);
      } else {
        _expression = '${_formatDisplay(current)} $op ';
        _previousValue = current;
      }
      _pendingOperator = op;
      _clearOnNextInput = true;
    });
  }

  void _pressEquals() {
    if (_pendingOperator == null) {
      // 演算子なし → そのまま確定して戻る
      final value = double.tryParse(_display) ?? 0;
      context.pop(value);
      return;
    }
    final current = double.tryParse(_display) ?? 0;
    final result = _calculate(_previousValue, current, _pendingOperator!);
    context.pop(result); // 計算結果を呼び出し元に返す
  }

  double _calculate(double a, double b, String op) {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b != 0 ? a / b : 0;
      default:
        return b;
    }
  }

  void _pressBackspace() {
    setState(() {
      if (_clearOnNextInput) return;
      if (_display.length <= 1) {
        _display = '0';
      } else {
        _display = _display.substring(0, _display.length - 1);
      }
    });
  }

  void _pressClear() {
    setState(() {
      _display = '0';
      _expression = '';
      _previousValue = 0;
      _pendingOperator = null;
      _clearOnNextInput = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final displayNum = double.tryParse(_display) ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('電卓'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(null),
        ),
      ),
      backgroundColor: colorScheme.surface,
      body: Column(
        children: [
          // 表示エリア
          Expanded(
            flex: 2,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              color: colorScheme.surfaceContainerHighest,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // 式の表示
                  Text(
                    _expression,
                    style: TextStyle(
                      fontSize: 16,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  // 現在値の表示
                  Text(
                    '¥${NumberFormat('#,##0').format(displayNum)}',
                    style: TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
          // ボタンエリア
          Expanded(
            flex: 5,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                children: [
                  _buildRow([
                    _CalcButton('AC', _pressClear, type: _BtnType.function),
                    _CalcButton('⌫', _pressBackspace, type: _BtnType.function),
                    const _CalcButton.spacer(),
                    _CalcButton('÷', () => _pressOperator('÷'),
                        type: _BtnType.operator,
                        active: _pendingOperator == '÷'),
                  ]),
                  _buildRow([
                    _CalcButton('7', () => _pressDigit('7')),
                    _CalcButton('8', () => _pressDigit('8')),
                    _CalcButton('9', () => _pressDigit('9')),
                    _CalcButton('×', () => _pressOperator('×'),
                        type: _BtnType.operator,
                        active: _pendingOperator == '×'),
                  ]),
                  _buildRow([
                    _CalcButton('4', () => _pressDigit('4')),
                    _CalcButton('5', () => _pressDigit('5')),
                    _CalcButton('6', () => _pressDigit('6')),
                    _CalcButton('-', () => _pressOperator('-'),
                        type: _BtnType.operator,
                        active: _pendingOperator == '-'),
                  ]),
                  _buildRow([
                    _CalcButton('1', () => _pressDigit('1')),
                    _CalcButton('2', () => _pressDigit('2')),
                    _CalcButton('3', () => _pressDigit('3')),
                    _CalcButton('+', () => _pressOperator('+'),
                        type: _BtnType.operator,
                        active: _pendingOperator == '+'),
                  ]),
                  _buildRow([
                    _CalcButton('0', () => _pressDigit('0'), wide: true),
                    _CalcButton('.', () => _pressDigit('.')),
                    _CalcButton('=', _pressEquals, type: _BtnType.equals),
                  ]),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(List<Widget> buttons) {
    return Expanded(
      child: Row(
        children: buttons.map((b) => Expanded(child: b)).toList(),
      ),
    );
  }
}

enum _BtnType { number, operator, function, equals }

class _CalcButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final _BtnType type;
  final bool active;  // 選択中の演算子に色を付ける
  final bool wide;    // 2倍幅（0ボタン用）
  final bool _isSpacer;

  const _CalcButton(
    this.label,
    this.onPressed, {
    this.type = _BtnType.number,
    this.active = false,
    this.wide = false,
  }) : _isSpacer = false;

  const _CalcButton.spacer()
      : label = '',
        onPressed = null,
        type = _BtnType.number,
        active = false,
        wide = false,
        _isSpacer = true;

  @override
  Widget build(BuildContext context) {
    if (_isSpacer) return const SizedBox();
    final colorScheme = Theme.of(context).colorScheme;

    Color bgColor;
    Color fgColor;
    switch (type) {
      case _BtnType.operator:
        bgColor = active
            ? colorScheme.primary
            : colorScheme.primaryContainer;
        fgColor = active
            ? colorScheme.onPrimary
            : colorScheme.onPrimaryContainer;
      case _BtnType.function:
        bgColor = colorScheme.secondaryContainer;
        fgColor = colorScheme.onSecondaryContainer;
      case _BtnType.equals:
        bgColor = colorScheme.primary;
        fgColor = colorScheme.onPrimary;
      case _BtnType.number:
        bgColor = colorScheme.surfaceContainerHigh;
        fgColor = colorScheme.onSurface;
    }

    return Padding(
      padding: const EdgeInsets.all(4),
      child: Material(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onPressed,
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w500,
                color: fgColor,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
