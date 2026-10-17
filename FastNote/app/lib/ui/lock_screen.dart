import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/lock.dart';
import 'widgets/pin_pad.dart';

// ロック画面。アプリ全体の上に重ねる（MaterialApp.builder から呼ぶので自前の Navigator を持つ）
class LockGate extends StatelessWidget {
  const LockGate({super.key});

  @override
  Widget build(BuildContext context) => HeroControllerScope.none( // アプリ本体の Navigator と HeroController を共有しない
        child: Navigator( // パスワード欄の選択メニューに Overlay が要るため
          onGenerateRoute: (_) => PageRouteBuilder(pageBuilder: (_, _, _) => const LockScreen()),
        ),
      );
}

class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  final _password = TextEditingController();
  String? _error;
  bool _verifying = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final lock = ref.read(lockProvider);
      if (lock.inPenalty) _startCountdown();
      if (lock.useBiometric) _biometric(); // 開いたらすぐ指紋・顔認証を出す
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _password.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) { // 残り秒数を描き直す
      if (!mounted) return;
      if (!ref.read(lockProvider).inPenalty) t.cancel();
      setState(() {});
    });
  }

  Future<void> _biometric() async {
    await ref.read(lockProvider).unlockWithBiometric();
  }

  Future<void> _verify(String secret) async {
    if (_verifying || secret.isEmpty) return;
    setState(() {
      _verifying = true;
      _error = null;
    });
    final lock = ref.read(lockProvider);
    final ok = await lock.verify(secret);
    if (!mounted) return;
    setState(() => _verifying = false);
    if (ok) return;
    _password.clear();
    if (lock.inPenalty) {
      _startCountdown();
    } else {
      setState(() => _error = '違います（あと${lock.remainingAttempts}回で30秒ロック）');
    }
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(lockProvider);
    final theme = Theme.of(context);
    final isPin = lock.type == LockType.pin;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline, size: 48, color: theme.colorScheme.primary),
                const SizedBox(height: 12),
                Text(isPin ? 'PIN を入力' : 'パスワードを入力', style: theme.textTheme.titleMedium),
                SizedBox(
                  height: 28,
                  child: Center(
                    child: Text(
                      lock.inPenalty ? '${lock.penaltySeconds}秒後に再試行できます' : (_error ?? ''),
                      style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                if (_verifying)
                  const Padding(padding: EdgeInsets.all(80), child: CircularProgressIndicator())
                else if (isPin)
                  PinPad(length: lock.pinLength, enabled: !lock.inPenalty, onSubmit: _verify)
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: Column(children: [
                      TextField(
                        controller: _password,
                        obscureText: true,
                        autofocus: !lock.useBiometric, // 生体認証を出すときはキーボードを重ねない
                        enabled: !lock.inPenalty,
                        enableSuggestions: false,
                        autocorrect: false,
                        decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'パスワード'),
                        onSubmitted: _verify,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: lock.inPenalty ? null : () => _verify(_password.text),
                          child: const Text('解除'),
                        ),
                      ),
                    ]),
                  ),
                if (lock.useBiometric) ...[
                  const SizedBox(height: 20),
                  TextButton.icon(onPressed: _biometric, icon: const Icon(Icons.fingerprint), label: const Text('指紋・顔認証で解除')),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
