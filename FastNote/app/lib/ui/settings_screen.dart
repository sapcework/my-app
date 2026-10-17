import 'dart:convert';
import 'dart:io';

import 'package:file_selector/file_selector.dart' show openFile;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart' show ShareParams, SharePlus, XFile;

import '../data/note_csv.dart';
import '../state/lock.dart';
import '../state/notes.dart';
import '../state/settings.dart';
import 'note_actions.dart';
import 'passcode_setup_screen.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final Future<bool> _biometricAvailable = ref.read(lockProvider).biometric.available();
  bool _busy = false;

  // ---- セキュリティ ----

  Future<void> _chooseLock() async {
    final lock = ref.read(lockProvider);
    final type = await showDialog<LockType>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('ロック方式'),
        children: [
          for (final t in LockType.values)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, t),
              child: Row(children: [
                Icon(t == lock.type ? Icons.radio_button_checked : Icons.radio_button_off, size: 20),
                const SizedBox(width: 12),
                Text(t.label),
              ]),
            ),
        ],
      ),
    );
    if (type == null || !mounted) return;
    if (type == LockType.none) {
      if (lock.enabled) {
        await lock.disable();
        showMessage('ロックを解除しました');
      }
      return;
    }
    final secret = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => PasscodeSetupScreen(type: type)));
    if (secret == null) return;
    setState(() => _busy = true);
    await lock.setSecret(type, secret); // ハッシュ計算に1秒ほどかかる
    if (mounted) setState(() => _busy = false);
    showMessage('${type == LockType.pin ? 'PIN' : 'パスワード'}を設定しました');
  }

  Future<void> _toggleBiometric(bool v) async {
    final lock = ref.read(lockProvider);
    if (v && !await lock.suspendRelock(lock.biometric.authenticate)) { // 使えることを確かめてから有効にする
      showMessage('認証できなかったため有効にしませんでした');
      return;
    }
    await lock.setUseBiometric(v);
  }

  // ---- データ ----

  Future<void> _import() async {
    final lock = ref.read(lockProvider);
    final notes = ref.read(notesProvider);
    final file = await lock.suspendRelock(() => openFile()); // バックアップは拡張子が無く、CSV も端末によって種類判定が不正確なので絞り込まない
    if (file == null || !mounted) return;
    String text;
    try {
      text = utf8.decode(await file.readAsBytes());
    } on FormatException {
      showMessage('高速メモ帳のバックアップでも CSV でもありません（UTF-8 のテキストではありません）');
      return;
    }
    final ImportPlan plan;
    try {
      plan = notes.planImportFrom(text);
    } on FormatException catch (e) {
      if (mounted) await _alert('取り込めません', e.message);
      return;
    }
    if (!mounted) return;
    final isBackup = plan.source == ImportSource.backup;
    final skipped = [
      if (plan.skippedExisting > 0) '同じメモが既にあるため ${plan.skippedExisting} 件',
      if (plan.skippedEmpty > 0) '本文が空のため ${plan.skippedEmpty} 件',
    ];
    if (plan.notes.isEmpty) {
      await _alert('取り込むメモがありません', skipped.isEmpty ? 'ファイルにメモが入っていません' : '${skipped.join('、')}を飛ばしました');
      return;
    }
    const maxWarnings = 5; // 多すぎるとダイアログが読めなくなるので先頭だけ見せる
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isBackup ? '高速メモ帳のバックアップを取り込む' : 'CSV を取り込む'),
        content: SingleChildScrollView(
          child: Text([
            '${file.name}\n',
            if (plan.hashOk == false) '⚠ 破損チェックに一致しません。ファイルが壊れているか、書き換えられている可能性があります。\n',
            '${plan.notes.length} 件のメモを追加します。',
            if (skipped.isNotEmpty) '（${skipped.join('、')}は飛ばします）',
            if (plan.warnings.isNotEmpty) ...[
              '\n気づいた点：',
              for (final w in plan.warnings.take(maxWarnings)) '・$w',
              if (plan.warnings.length > maxWarnings) '・ほか ${plan.warnings.length - maxWarnings} 件',
            ],
            '\n今あるメモは変更しません。',
          ].join('\n')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('キャンセル')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('取り込む')),
        ],
      ),
    );
    if (ok != true) return;
    await notes.applyImport(plan);
    showMessage('${plan.notes.length} 件のメモを取り込みました');
  }

  Future<void> _export() async {
    final lock = ref.read(lockProvider);
    final notes = ref.read(notesProvider);
    if (notes.notes.isEmpty) {
      showMessage('書き出すメモがありません');
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('CSV で書き出す'),
        content: Text('${notes.notes.length} 件のメモを CSV にして共有します。\n\n'
            'ファイルは暗号化されません。保存先や送り先に気をつけてください。\n'
            'このファイルを「取り込む」で読み込むと復元できます。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('キャンセル')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('書き出す')),
        ],
      ),
    );
    if (ok != true) return;
    final dir = await getTemporaryDirectory();
    await for (final f in dir.list()) { // 前回の書き出しファイルを残さない
      if (f is File && p.basename(f.path).startsWith('fastnote_') && f.path.endsWith('.csv')) await f.delete();
    }
    final name = 'fastnote_${DateFormat('yyyyMMdd_HHmmss').format(DateTime.now())}.csv'; // 抽出ツールと同じ名前の形
    final file = File(p.join(dir.path, name));
    await file.writeAsString(notes.exportCsv(), flush: true);
    await lock.suspendRelock(() => SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'text/csv')], subject: name)));
  }

  Future<void> _alert(String title, String body) => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final lock = ref.watch(lockProvider);
    final count = ref.watch(notesProvider).notes.length;
    final theme = Theme.of(context);
    Widget header(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
          child: Text(t, style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        );
    String relockLabel(int s) => s == 0 ? 'すぐ' : '${s ~/ 60}分後';

    return Scaffold(
      appBar: AppBar(title: const Text('設定')),
      body: AbsorbPointer(
        absorbing: _busy,
        child: ListView(children: [
          header('表示'),
          ListTile(
            title: const Text('文字サイズ'),
            trailing: Text('${settings.fontSize.round()}'),
            subtitle: Slider(
              min: SettingsController.minFontSize,
              max: SettingsController.maxFontSize,
              divisions: (SettingsController.maxFontSize - SettingsController.minFontSize).round(),
              value: settings.fontSize,
              label: '${settings.fontSize.round()}',
              onChanged: settings.setFontSize,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('メモの文字はこの大きさになります', style: TextStyle(fontSize: settings.fontSize)),
          ),
          ListTile(
            title: const Text('並び順'),
            subtitle: const Text('☆を付けたメモは常に先頭に固定されます'),
            trailing: DropdownButton<SortMode>(
              value: settings.sort,
              onChanged: (v) => settings.setSort(v!),
              items: [for (final m in SortMode.values) DropdownMenuItem(value: m, child: Text(m.label))],
            ),
          ),

          header('セキュリティ'),
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('ロック'),
            subtitle: Text(lock.enabled ? '${lock.type.label}（タップで変更）' : 'なし'),
            trailing: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : null,
            onTap: _chooseLock,
          ),
          FutureBuilder<bool>(
            future: _biometricAvailable,
            builder: (context, snap) {
              final available = snap.data ?? false;
              return SwitchListTile(
                secondary: const Icon(Icons.fingerprint),
                title: const Text('指紋・顔認証で解除'),
                subtitle: Text(!available
                    ? 'この端末では使えないか、指紋・顔が登録されていません'
                    : lock.enabled
                        ? 'PIN・パスワードの代わりに使えます'
                        : '先にロックを設定してください'),
                value: lock.useBiometric,
                onChanged: available && lock.enabled ? _toggleBiometric : null,
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.timer_outlined),
            title: const Text('ロックするまでの時間'),
            subtitle: const Text('アプリを閉じてから再びロックするまで'),
            enabled: lock.enabled,
            trailing: DropdownButton<int>(
              value: lock.relockSeconds,
              onChanged: lock.enabled ? (v) => lock.setRelockSeconds(v!) : null,
              items: [for (final s in LockController.relockChoices) DropdownMenuItem(value: s, child: Text(relockLabel(s)))],
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.visibility_off_outlined),
            title: const Text('履歴画面で内容を隠す'),
            subtitle: const Text('最近使ったアプリの一覧にメモを映さない（スクリーンショットも撮れなくなります）'),
            value: lock.hideInRecents,
            onChanged: lock.enabled ? lock.setHideInRecents : null,
          ),

          header('データ'),
          ListTile(
            leading: const Icon(Icons.file_download_outlined),
            title: const Text('取り込む'),
            subtitle: const Text('高速メモ帳のバックアップ、または CSV（抽出ツールの出力・このアプリの書き出し）'),
            onTap: _import,
          ),
          ListTile(
            leading: const Icon(Icons.file_upload_outlined),
            title: const Text('CSV で書き出す（バックアップ）'),
            subtitle: Text('$count 件のメモ'),
            onTap: _export,
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'メモはこの端末の中だけに保存され、通信は一切しません。端末の自動バックアップにも含まれないため、機種変更の前には CSV で書き出してください。',
              style: theme.textTheme.bodySmall,
            ),
          ),
        ]),
      ),
    );
  }
}

