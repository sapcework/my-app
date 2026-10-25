import 'package:flutter/material.dart';

class StartupErrorScreen extends StatelessWidget { // データを開けず起動できなかったときの画面。内部のエラー文は見せず、次にすることを伝える
  final VoidCallback onRetry;
  const StartupErrorScreen({super.key, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                const SizedBox(height: 16),
                Text('データを開けませんでした', style: theme.textTheme.titleLarge),
                const SizedBox(height: 12),
                const Text(
                  '家計簿がほかの画面ですでに開いている場合は、そちらを閉じてから「もう一度試す」を押してください。'
                  'それでも開けない場合は、端末を再起動してからアプリを開き直してください。',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('もう一度試す')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
