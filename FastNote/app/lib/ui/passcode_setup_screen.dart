import 'package:flutter/material.dart';

import '../state/lock.dart';
import 'widgets/pin_pad.dart';

// PIN・パスワードの設定画面。2回入力して一致したら Navigator.pop で値を返す
class PasscodeSetupScreen extends StatefulWidget {
  final LockType type;
  const PasscodeSetupScreen({super.key, required this.type});

  @override
  State<PasscodeSetupScreen> createState() => _PasscodeSetupScreenState();
}

class _PasscodeSetupScreenState extends State<PasscodeSetupScreen> {
  static const minPasswordLength = 4;

  final _first = TextEditingController();
  final _second = TextEditingController();
  String? _pinFirst; // PIN の1回目
  String? _error;

  @override
  void dispose() {
    _first.dispose();
    _second.dispose();
    super.dispose();
  }

  void _onPin(String pin) {
    if (_pinFirst == null) {
      setState(() {
        _pinFirst = pin;
        _error = null;
      });
    } else if (_pinFirst == pin) {
      Navigator.pop(context, pin);
    } else {
      setState(() {
        _pinFirst = null;
        _error = '一致しませんでした。最初から入力してください';
      });
    }
  }

  void _onPassword() {
    final a = _first.text, b = _second.text;
    if (a.length < minPasswordLength) {
      setState(() => _error = '$minPasswordLength文字以上にしてください');
    } else if (a != b) {
      setState(() => _error = '確認用の入力が一致しません');
    } else {
      Navigator.pop(context, a);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPin = widget.type == LockType.pin;
    final error = _error == null
        ? const SizedBox(height: 24)
        : SizedBox(height: 24, child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)));

    return Scaffold(
      appBar: AppBar(title: Text(isPin ? 'PIN を設定' : 'パスワードを設定')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: isPin
                ? Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(_pinFirst == null ? '4〜8桁の数字を入力して OK' : '確認のためもう一度入力', style: theme.textTheme.titleMedium),
                    error,
                    PinPad(key: ValueKey(_pinFirst == null), onSubmit: _onPin), // 2回目は入力欄を作り直す
                  ])
                : ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      TextField(
                        controller: _first,
                        obscureText: true,
                        autofocus: true,
                        enableSuggestions: false,
                        autocorrect: false,
                        decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'パスワード（4文字以上）'),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _second,
                        obscureText: true,
                        enableSuggestions: false,
                        autocorrect: false,
                        decoration: const InputDecoration(border: OutlineInputBorder(), labelText: '確認のためもう一度'),
                        onSubmitted: (_) => _onPassword(),
                      ),
                      const SizedBox(height: 8),
                      error,
                      SizedBox(width: double.infinity, child: FilledButton(onPressed: _onPassword, child: const Text('設定する'))),
                      const SizedBox(height: 16),
                      Text('忘れるとメモを開けなくなります。再インストールすると解除できますが、メモもすべて消えます。',
                          style: theme.textTheme.bodySmall),
                    ]),
                  ),
          ),
        ),
      ),
    );
  }
}
