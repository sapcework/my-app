import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 起動に失敗したときの画面。白い画面のまま止まらないよう、原因の種類と次にやることを出す
class StartupErrorApp extends StatelessWidget {
  final Object error;
  const StartupErrorApp({super.key, required this.error});

  String get _kind => switch (error) { // 利用者に分かる言葉で原因の種類を出す（詳細は下に小さく）
        final Object e when e.toString().contains('database') || e.toString().contains('sqlite') => 'メモの保存場所を開けませんでした',
        final Object e when e.toString().contains('No space') || e.toString().contains('ENOSPC') => '端末の空き容量が足りません',
        _ => '予期しない問題が起きました',
      };

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'FastNote',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF6D7CF2)),
        home: Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 16),
                  const Text('FastNote を起動できませんでした', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(_kind),
                  const SizedBox(height: 16),
                  const Text('次の順にお試しください。'),
                  const Text('1. FastNote を閉じて、もう一度開く'),
                  const Text('2. 端末の空き容量を確かめる（設定 → ストレージ）'),
                  const Text('3. 端末を再起動する'),
                  const SizedBox(height: 12),
                  const Text('メモはこの端末に残っています。アプリを削除すると消えてしまうので、削除はしないでください。'),
                  const SizedBox(height: 24),
                  Text('詳細：${error.runtimeType}', style: const TextStyle(fontSize: 12, color: Colors.grey)), // 原因を調べるときの手がかり（メモの内容は含まない）
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: () => SystemNavigator.pop(), child: const Text('閉じる')),
                ]),
              ),
            ),
          ),
        ),
      );
}
