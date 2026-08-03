import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/passcode_provider.dart';
import '../../widgets/pin_pad.dart';

// アプリ起動時のパスコードロック画面（Web版 PasscodeLock.tsx に対応）
// 5回連続失敗で30秒ロックし、カウントダウンを表示する
class PasscodeLockScreen extends ConsumerStatefulWidget {
  const PasscodeLockScreen({super.key});

  @override
  ConsumerState<PasscodeLockScreen> createState() => _PasscodeLockScreenState();
}

class _PasscodeLockScreenState extends ConsumerState<PasscodeLockScreen> {
  String? _error;
  bool _verifying = false;
  Timer? _lockTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { // 起動時点でロック中ならカウントダウンを開始
      if (mounted && ref.read(passcodeControllerProvider).isLocked) {
        _startLockCountdown();
      }
    });
  }

  @override
  void dispose() {
    _lockTimer?.cancel();
    super.dispose();
  }

  void _startLockCountdown() {
    _lockTimer?.cancel();
    _lockTimer = Timer.periodic(const Duration(seconds: 1), (timer) { // 残り秒数の再描画用
      if (!mounted) return;
      final controller = ref.read(passcodeControllerProvider);
      if (!controller.isLocked) timer.cancel();
      setState(() {});
    });
  }

  Future<void> _onPinEntered(String pin) async {
    if (_verifying) return;
    setState(() {
      _verifying = true;
      _error = null;
    });
    final controller = ref.read(passcodeControllerProvider);
    final ok = await controller.verify(pin);
    if (!mounted) return;
    setState(() => _verifying = false);
    if (!ok) {
      if (controller.isLocked) {
        _startLockCountdown();
        setState(() => _error = null); // ロック中表示に切り替わるためエラー文は消す
      } else {
        setState(() => _error =
            'パスコードが違います（あと${controller.remainingAttempts}回で一時ロック）');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(passcodeControllerProvider);
    final isLocked = controller.isLocked;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_outline,
                    size: 48, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 16),
                Text('パスコードを入力',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                SizedBox(
                  height: 20,
                  child: _error != null
                      ? Text(
                          _error!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        )
                      : null,
                ),
                const SizedBox(height: 16),
                if (isLocked) // ロック中はテンキーを隠してカウントダウン表示
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Column(
                      children: [
                        Icon(Icons.timer_outlined,
                            size: 32,
                            color: Theme.of(context).colorScheme.error),
                        const SizedBox(height: 12),
                        Text(
                          '${controller.lockRemainingSeconds}秒後に再試行できます',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        ),
                      ],
                    ),
                  )
                else if (_verifying)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 100),
                    child: CircularProgressIndicator(),
                  )
                else
                  PinPad(onCompleted: _onPinEntered),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
