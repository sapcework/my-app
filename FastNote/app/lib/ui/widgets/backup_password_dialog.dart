import 'package:flutter/material.dart';

import '../../data/encrypted_backup.dart';

// 暗号化バックアップのパスワード入力。書き出し（confirm: true）では2回入力して一致を確かめる
Future<String?> askBackupPassword(BuildContext context, {required bool confirm, String? error}) =>
    showDialog<String>(context: context, builder: (_) => _BackupPasswordDialog(confirm: confirm, initialError: error));

class _BackupPasswordDialog extends StatefulWidget {
  final bool confirm;
  final String? initialError;
  const _BackupPasswordDialog({required this.confirm, this.initialError});

  @override
  State<_BackupPasswordDialog> createState() => _BackupPasswordDialogState();
}

class _BackupPasswordDialogState extends State<_BackupPasswordDialog> {
  final _first = TextEditingController();
  final _second = TextEditingController();
  bool _visible = false;
  late String? _error = widget.initialError;

  @override
  void dispose() {
    _first.dispose();
    _second.dispose();
    super.dispose();
  }

  void _submit() {
    final pw = _first.text;
    if (widget.confirm && pw.length < minBackupPasswordLength) {
      setState(() => _error = '$minBackupPasswordLength文字以上にしてください');
    } else if (widget.confirm && pw != _second.text) {
      setState(() => _error = '確認用の入力が一致しません');
    } else if (pw.isNotEmpty) {
      Navigator.pop(context, pw);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    InputDecoration deco(String label) => InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          suffixIcon: IconButton(
            tooltip: _visible ? '隠す' : '表示する',
            icon: Icon(_visible ? Icons.visibility_off : Icons.visibility),
            onPressed: () => setState(() => _visible = !_visible),
          ),
        );
    return AlertDialog(
      title: Text(widget.confirm ? 'バックアップのパスワード' : 'パスワードを入力'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.confirm) ...[
            const Text('復元するときに、このパスワードが必要になります。'),
            const SizedBox(height: 4),
            Text('忘れると、このバックアップは誰にも復元できません。', style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _first,
            autofocus: true,
            obscureText: !_visible,
            enableSuggestions: false,
            autocorrect: false,
            decoration: deco(widget.confirm ? 'パスワード（$minBackupPasswordLength文字以上）' : 'パスワード'),
            onSubmitted: (_) => widget.confirm ? null : _submit(),
          ),
          if (widget.confirm) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _second,
              obscureText: !_visible,
              enableSuggestions: false,
              autocorrect: false,
              decoration: deco('確認のためもう一度'),
              onSubmitted: (_) => _submit(),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
          ],
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('キャンセル')),
        FilledButton(onPressed: _submit, child: Text(widget.confirm ? '暗号化して書き出す' : '開く')),
      ],
    );
  }
}
