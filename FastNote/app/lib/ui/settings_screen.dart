import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_selector/file_selector.dart' show openFile;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart' show ShareParams, SharePlus, XFile;

import '../data/encrypted_backup.dart';
import '../data/note_csv.dart';
import '../state/lock.dart';
import '../state/notes.dart';
import '../state/settings.dart';
import 'about_screen.dart';
import 'note_actions.dart';
import 'passcode_setup_screen.dart';
import 'text_layout_screen.dart';
import 'widgets/backup_password_dialog.dart';

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

  Future<T> _withProgress<T>(String label, Future<T> Function() task) async { // 鍵の導出に1〜2秒かかるので、待っていることを見せる
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PopScope(
        canPop: false,
        child: AlertDialog(content: Row(children: [const CircularProgressIndicator(), const SizedBox(width: 20), Expanded(child: Text(label))])),
      ),
    );
    try {
      return await task();
    } finally {
      if (mounted) Navigator.of(context).pop();
    }
  }

  Future<String?> _decryptWithPrompt(Uint8List bytes) async { // パスワードを聞いて復号する。違えば聞き直す
    String? error;
    while (true) {
      if (!mounted) return null;
      final pw = await askBackupPassword(context, confirm: false, error: error);
      if (pw == null || !mounted) return null;
      try {
        return await _withProgress('復号しています…', () => decryptBackup(bytes, pw));
      } on BackupPasswordException {
        error = 'パスワードが違うか、ファイルが壊れています';
      } on FormatException catch (e) {
        if (mounted) await _alert('取り込めません', e.message);
        return null;
      }
    }
  }

  Future<void> _import() async {
    final lock = ref.read(lockProvider);
    final notes = ref.read(notesProvider);
    final file = await lock.suspendRelock(() => openFile()); // バックアップは拡張子が端末任せで、CSV も種類判定が不正確なので絞り込まない
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    final encrypted = looksLikeEncryptedBackup(bytes);
    String text;
    if (encrypted) {
      final t = await _decryptWithPrompt(bytes);
      if (t == null) return;
      text = t;
    } else {
      try {
        text = utf8.decode(bytes);
      } on FormatException {
        showMessage('FastNote のバックアップでも、高速メモ帳のバックアップでも、CSV でもありません');
        return;
      }
    }
    final ImportPlan plan;
    try {
      plan = notes.planImportFrom(text);
    } on FormatException catch (e) {
      if (mounted) await _alert('取り込めません', e.message);
      return;
    }
    if (!mounted) return;
    final title = encrypted
        ? 'バックアップを取り込む'
        : plan.source == ImportSource.backup
            ? '高速メモ帳のバックアップを取り込む'
            : 'CSV を取り込む';
    final skipped = [
      if (plan.skippedExisting > 0) '同じメモが既にあるため ${plan.skippedExisting} 件',
      if (plan.skippedEmpty > 0) '本文が空のため ${plan.skippedEmpty} 件',
    ];
    if (plan.notes.isEmpty) {
      await _alert('取り込むメモがありません', skipped.isEmpty ? 'ファイルにメモが入っていません' : '${skipped.join('、')}を飛ばしました');
      return;
    }
    const maxWarnings = 5; // 多すぎるとダイアログが読めなくなるので先頭だけ見せる
    final askColors = !encrypted && plan.source == ImportSource.backup && plan.coloredCount > 0; // 色を選べるのは高速メモ帳のバックアップだけ（自分で付けた色は必ず戻す）
    var importColors = false; // 高速メモ帳は画面で使っていない色の値を保存していることがあるので、初期値は取り込まない
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text([
                '${file.name}\n',
                if (plan.hashOk == false) '⚠ 破損チェックに一致しません。ファイルが壊れているか、書き換えられている可能性があります。\n',
                '${plan.notes.length} 件のメモを追加します。',
                if (plan.newFolders.isNotEmpty) '（フォルダ「${plan.newFolders.map((f) => f.name).join('」「')}」を作ります）',
                if (skipped.isNotEmpty) '（${skipped.join('、')}は飛ばします）',
                if (plan.warnings.isNotEmpty) ...[
                  '\n気づいた点：',
                  for (final w in plan.warnings.take(maxWarnings)) '・$w',
                  if (plan.warnings.length > maxWarnings) '・ほか ${plan.warnings.length - maxWarnings} 件',
                ],
                '\n今あるメモは変更しません。',
              ].join('\n')),
              if (askColors)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: importColors,
                  onChanged: (v) => setState(() => importColors = v ?? false),
                  title: const Text('高速メモ帳の色を取り込む'),
                  subtitle: Text('色の付いたメモ ${plan.coloredCount} 件。高速メモ帳で色を使っていなければ、オフのままにしてください'),
                ),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('キャンセル')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('取り込む')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    await notes.applyImport(askColors && !importColors ? plan.withoutColors() : plan);
    showMessage('${plan.notes.length} 件のメモを取り込みました');
  }

  Future<void> _export() async {
    final notes = ref.read(notesProvider);
    if (notes.notes.isEmpty) {
      showMessage('書き出すメモがありません');
      return;
    }
    final format = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('書き出す形式'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, 'encrypted'),
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.lock_outline),
              title: Text('暗号化バックアップ（おすすめ）'),
              subtitle: Text('パスワードが無いと開けません。メモ帳や Excel で開いても読めません。フォルダ・☆なども残ります'),
            ),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, 'csv'),
            child: const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.table_chart_outlined),
              title: Text('CSV（暗号化なし）'),
              subtitle: Text('Excel で中身を確かめられます。誰でも読めるので、保存先や送り先に気をつけてください'),
            ),
          ),
        ],
      ),
    );
    if (format == null || !mounted) return;
    final dir = await getTemporaryDirectory();
    await for (final f in dir.list()) { // 前回の書き出しファイルを残さない
      final name = p.basename(f.path);
      if (f is File && name.startsWith('fastnote_') && (name.endsWith('.csv') || name.endsWith('.$backupExtension'))) await f.delete();
    }
    final stamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final File file;
    final String mime;
    if (!mounted) return;
    if (format == 'encrypted') {
      final pw = await askBackupPassword(context, confirm: true);
      if (pw == null || !mounted) return;
      final data = await _withProgress('暗号化しています…', () => encryptBackup(notes.exportCsv(), pw));
      file = File(p.join(dir.path, 'fastnote_$stamp.$backupExtension'));
      await file.writeAsBytes(data, flush: true);
      mime = 'application/octet-stream';
    } else {
      file = File(p.join(dir.path, 'fastnote_$stamp.csv')); // 抽出ツールと同じ名前の形
      await file.writeAsString(notes.exportCsv(), flush: true);
      mime = 'text/csv';
    }
    final lock = ref.read(lockProvider);
    await lock.suspendRelock(() => SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: mime)], subject: p.basename(file.path))));
  }

  Future<void> _clearColors() async { // 取り込んだメモに想定外の色が付いていたときなどに使う
    final notes = ref.read(notesProvider);
    final n = notes.coloredCount;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('メモの色をすべて消す'),
        content: Text('色の付いたメモ $n 件の文字色と背景色を消して、既定の色に戻します。\nメモの本文と並び順は変わりません。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('キャンセル')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('色を消す')),
        ],
      ),
    );
    if (ok != true) return;
    final cleared = await notes.clearAllColors();
    showMessage('$cleared 件のメモの色を消しました');
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
    final colored = ref.watch(notesProvider).coloredCount;
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
            leading: const Icon(Icons.format_size),
            title: const Text('文字の大きさ・行間'),
            subtitle: Text(TextLayoutScreen.summary(settings)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TextLayoutScreen())),
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
            subtitle: const Text('このアプリのバックアップ、高速メモ帳のバックアップ、CSV'),
            onTap: _import,
          ),
          ListTile(
            leading: const Icon(Icons.file_upload_outlined),
            title: const Text('バックアップを書き出す'),
            subtitle: Text('$count 件のメモ（暗号化バックアップ または CSV）'),
            onTap: _export,
          ),
          ListTile(
            leading: const Icon(Icons.format_color_reset),
            title: const Text('メモの色をすべて消す'),
            subtitle: Text(colored == 0 ? '色の付いたメモはありません' : '色の付いたメモ $colored 件を既定の色に戻します'),
            enabled: colored > 0,
            onTap: _clearColors,
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'メモはこの端末の中だけに保存され、通信は一切しません。端末の自動バックアップにも含まれないため、機種変更の前には「バックアップを書き出す」で保存してください。',
              style: theme.textTheme.bodySmall,
            ),
          ),

          header('このアプリについて'),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('FastNote について'),
            subtitle: Text(appVersionLabel(ref.watch(appInfoProvider))),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen())),
          ),
        ]),
      ),
    );
  }
}

