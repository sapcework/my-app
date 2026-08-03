import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../../data/backup/backup_parser.dart';
import '../../../data/models/budget_model.dart';
import '../../../data/models/category_model.dart';
import '../../../data/models/expense_model.dart';
import '../../../data/models/recurring_expense_model.dart';
import '../../providers/category_providers.dart';
import '../../providers/isar_provider.dart';
import '../../providers/passcode_provider.dart';
import '../../providers/recurring_expense_providers.dart';
import '../../providers/repository_providers.dart';
import '../../widgets/pin_pad.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _working = false;

  // ============================================================
  // バックアップ
  // ============================================================
  Future<void> _backup() async {
    if (_working) return;

    // Web版と同じく書き出し前に対象ファイル名を見せて確認する
    final ts = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
    final fileName = 'kakeibo_backup_$ts.json';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('バックアップ'),
        content: Text('「$fileName」として全データを書き出します。よろしいですか？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('書き出す'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = true);
    try {
      final expenseRepo = ref.read(expenseRepositoryProvider);
      final categoryRepo = ref.read(categoryRepositoryProvider);
      final budgetRepo = ref.read(budgetRepositoryProvider);
      final recurringRepo = ref.read(recurringExpenseRepositoryProvider);

      final expenses = await expenseRepo.watchAll().first;
      final categories = await categoryRepo.watchAll().first;
      final budgets = await budgetRepo.getAll();
      final recurring = await recurringRepo.watchAll().first;

      final data = {
        'version': '1',
        'exportedAt': DateTime.now().toIso8601String(),
        'expenses': expenses.map((e) => {
              'id': e.id,
              'amount': e.amount,
              'categoryId': e.categoryId,
              'itemName': e.itemName,
              'memo': e.memo,
              'date': e.date.toIso8601String(),
              'createdAt': e.createdAt.toIso8601String(),
            }).toList(),
        'categories': categories.map((c) => {
              'id': c.id,
              'name': c.name,
              'colorValue': c.colorValue,
              'iconName': c.iconName,
              'sortOrder': c.sortOrder,
              'createdAt': c.createdAt.toIso8601String(),
            }).toList(),
        'budgets': budgets.map((b) => {
              'id': b.id,
              'year': b.year,
              'month': b.month,
              'amount': b.amount,
            }).toList(),
        'recurring': recurring.map((r) => {
              'id': r.id,
              'name': r.name,
              'amount': r.amount,
              'categoryId': r.categoryId,
              'dayOfMonth': r.dayOfMonth,
              'isActive': r.isActive,
            }).toList(),
      };

      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$fileName');
      await file.writeAsString(jsonEncode(data));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('バックアップ完了: ${file.path}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('バックアップに失敗しました: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  // ============================================================
  // 復元
  // ============================================================
  Future<void> _restore() async {
    final dir = await getApplicationDocumentsDirectory();
    final backups = dir
        .listSync()
        .whereType<File>()
        .where((f) => f.path.contains('kakeibo_backup_') && f.path.endsWith('.json'))
        .toList()
      ..sort((a, b) => b.path.compareTo(a.path)); // 新しい順

    if (!mounted) return;

    if (backups.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('バックアップファイルが見つかりません')),
      );
      return;
    }

    final picked = await showModalBottomSheet<File>(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('復元するバックアップを選択',
                style: Theme.of(ctx).textTheme.titleMedium),
          ),
          const Divider(height: 1),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: backups.length,
              itemBuilder: (_, i) {
                final name = backups[i].uri.pathSegments.last;
                return ListTile(
                  leading: const Icon(Icons.restore),
                  title: Text(name, style: const TextStyle(fontSize: 13)),
                  onTap: () => Navigator.pop(ctx, backups[i]),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );

    if (picked == null || !mounted) return;

    // 復元前に全行を型検証（Web版 parseBackup 相当）。不正なファイルはここで拒否する
    final BackupData data;
    try {
      data = parseBackup(await picked.readAsString());
    } on FormatException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('復元できません: ${e.message}')),
        );
      }
      return;
    }
    if (!mounted) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('データを復元しますか？'),
        content: Text('現在のすべてのデータが上書きされます。\n\n'
            '支出: ${data.expenses.length}件\n'
            'カテゴリ: ${data.categories.length}件\n'
            '予算: ${data.budgets.length}件\n'
            '定期支出: ${data.recurring.length}件'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('復元する'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _working = true);
    try {
      final isar = ref.read(isarProvider).requireValue;

      await isar.writeTxn(() async {
        await isar.expenseModels.clear();
        await isar.categoryModels.clear();
        await isar.budgetModels.clear();
        await isar.recurringExpenseModels.clear();

        await isar.categoryModels.putAll(data.categories); // IDを保持して復元
        await isar.expenseModels.putAll(data.expenses);
        await isar.budgetModels.putAll(data.budgets);
        await isar.recurringExpenseModels.putAll(data.recurring);
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('復元が完了しました')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('復元に失敗しました: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  // ============================================================
  // 全明細CSV出力（全年月）
  // ============================================================
  Future<void> _exportAllCsv() async {
    if (_working) return;
    final expenseRepo = ref.read(expenseRepositoryProvider);
    final categoryRepo = ref.read(categoryRepositoryProvider);

    final expenses = await expenseRepo.watchAll().first;
    if (expenses.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('支出データがありません')),
        );
      }
      return;
    }

    // Web版と同じく書き出し前に対象ファイル名を見せて確認する
    final fileName = 'kakeibo_all_${DateFormat('yyyy-MM-dd').format(DateTime.now())}.csv';
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('全明細CSV出力'),
        content: Text('「$fileName」として全期間の支出明細を書き出します。よろしいですか？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('書き出す')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = true);
    try {
      final categories = await categoryRepo.watchAll().first;
      final catMap = {for (final c in categories) if (c.id != null) c.id!: c};

      final sorted = [...expenses]..sort((a, b) => a.date.compareTo(b.date));

      final buf = StringBuffer();
      buf.writeln('日付,カテゴリ,項目名,メモ,金額,登録日時');
      final dateFmt = DateFormat('yyyy/MM/dd');
      final tsFmt = DateFormat('yyyyMMddHHmmss');
      for (final e in sorted) {
        buf.writeln([
          dateFmt.format(e.date),
          _csv(catMap[e.categoryId]?.name ?? '不明'),
          _csv(e.itemName ?? ''),
          _csv(e.memo ?? ''),
          e.amount.toStringAsFixed(0),
          tsFmt.format(e.createdAt),
        ].join(','));
      }

      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes([0xEF, 0xBB, 0xBF, ...utf8.encode(buf.toString())]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('出力完了: ${file.path}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('出力に失敗しました: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  // ============================================================
  // 月別支出表CSV（行=年月、列=カテゴリ）
  // ============================================================
  Future<void> _exportMonthlyCsv() async {
    if (_working) return;
    final expenseRepo = ref.read(expenseRepositoryProvider);
    final categoryRepo = ref.read(categoryRepositoryProvider);

    final expenses = await expenseRepo.watchAll().first;
    if (expenses.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('支出データがありません')),
        );
      }
      return;
    }

    // Web版と同じく書き出し前に対象ファイル名を見せて確認する
    final fileName = 'kakeibo_monthly_${DateFormat('yyyy-MM-dd').format(DateTime.now())}.csv';
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('月別支出表CSV出力'),
        content: Text('「$fileName」として月別支出表を書き出します。よろしいですか？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('書き出す')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = true);
    try {
      final categories = await categoryRepo.watchAll().first;
      final usedCatIds = expenses.map((e) => e.categoryId).toSet();
      final cols = categories.where((c) => c.id != null && usedCatIds.contains(c.id)).toList();

      final months = expenses
          .map((e) => '${e.date.year}-${e.date.month.toString().padLeft(2, '0')}')
          .toSet()
          .toList()
        ..sort();

      final buf = StringBuffer();
      buf.writeln(['年月', ...cols.map((c) => c.name), '合計'].join(','));

      for (final month in months) {
        final mes = expenses.where((e) {
          final m = '${e.date.year}-${e.date.month.toString().padLeft(2, '0')}';
          return m == month;
        }).toList();
        final catTotals = cols.map(
            (cat) => mes.where((e) => e.categoryId == cat.id).fold<double>(0, (s, e) => s + e.amount));
        final total = mes.fold<double>(0, (s, e) => s + e.amount);
        buf.writeln([month, ...catTotals.map((v) => v.toStringAsFixed(0)), total.toStringAsFixed(0)].join(','));
      }

      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes([0xEF, 0xBB, 0xBF, ...utf8.encode(buf.toString())]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('出力完了: ${file.path}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('出力に失敗しました: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  String _csv(String v) {
    if (v.contains(',') || v.contains('"') || v.contains('\n')) {
      return '"${v.replaceAll('"', '""')}"';
    }
    return v;
  }

  // ============================================================
  // パスコードロック
  // ============================================================
  Future<String?> _promptPin(String title) {
    return showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              child: Text(title, style: Theme.of(ctx).textTheme.titleMedium),
            ),
            PinPad(onCompleted: (pin) => Navigator.pop(ctx, pin)),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _togglePasscode() async {
    final controller = ref.read(passcodeControllerProvider);
    final messenger = ScaffoldMessenger.of(context);

    if (controller.enabled) { // 有効→現在のPINを検証してから解除
      if (controller.isLocked) {
        messenger.showSnackBar(SnackBar(
            content: Text('ロック中です。${controller.lockRemainingSeconds}秒後に再試行してください')));
        return;
      }
      final pin = await _promptPin('現在のパスコードを入力');
      if (pin == null || !mounted) return;
      setState(() => _working = true);
      final ok = await controller.verify(pin);
      if (!mounted) return;
      setState(() => _working = false);
      if (!ok) {
        messenger.showSnackBar(SnackBar(
            content: Text(controller.isLocked
                ? '5回連続で間違えたため30秒間ロックされました'
                : 'パスコードが違います')));
        return;
      }
      await controller.removePasscode();
      messenger.showSnackBar(const SnackBar(content: Text('パスコードロックを解除しました')));
    } else { // 無効→新しいPINを2回入力して設定
      final pin1 = await _promptPin('新しいパスコードを入力');
      if (pin1 == null || !mounted) return;
      final pin2 = await _promptPin('確認のためもう一度入力');
      if (pin2 == null || !mounted) return;
      if (pin1 != pin2) {
        messenger.showSnackBar(const SnackBar(content: Text('パスコードが一致しません')));
        return;
      }
      setState(() => _working = true);
      await controller.setPasscode(pin1);
      if (!mounted) return;
      setState(() => _working = false);
      messenger.showSnackBar(const SnackBar(content: Text('パスコードロックを設定しました')));
    }
  }

  // ============================================================
  // UI
  // ============================================================
  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const [];
    final recurring = ref.watch(recurringExpensesProvider).valueOrNull ?? const [];
    final passcode = ref.watch(passcodeControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('設定')),
      body: _working
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── データ管理セクション ──
                const _SectionLabel('データ管理'),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _SettingsTile(
                        icon: Icons.download_outlined,
                        iconBgColor: const Color(0xFFEEF2FF), // indigo-50
                        iconColor: const Color(0xFF4F46E5), // indigo-600
                        title: 'バックアップ',
                        subtitle: '全データをJSONファイルに書き出す',
                        onTap: _backup,
                      ),
                      const Divider(height: 1, indent: 56),
                      _SettingsTile(
                        icon: Icons.upload_outlined,
                        iconBgColor: const Color(0xFFF0FDF4), // emerald-50
                        iconColor: const Color(0xFF16A34A), // emerald-600
                        title: '復元',
                        subtitle: 'バックアップファイルから復元する',
                        onTap: _restore,
                      ),
                      const Divider(height: 1, indent: 56),
                      _SettingsTile(
                        icon: Icons.article_outlined,
                        iconBgColor: const Color(0xFFF5F3FF), // violet-50
                        iconColor: const Color(0xFF7C3AED), // violet-600
                        title: '全明細CSV出力',
                        subtitle: '全年月の支出明細を1ファイルに出力',
                        onTap: _exportAllCsv,
                      ),
                      const Divider(height: 1, indent: 56),
                      _SettingsTile(
                        icon: Icons.table_chart_outlined,
                        iconBgColor: const Color(0xFFFFFBEB), // amber-50
                        iconColor: const Color(0xFFD97706), // amber-600
                        title: '月別支出表CSV出力',
                        subtitle: '行=年月・列=カテゴリの集計表を出力',
                        onTap: _exportMonthlyCsv,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── 管理セクション ──
                const _SectionLabel('管理'),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _SettingsTile(
                        icon: Icons.category_outlined,
                        iconBgColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                        iconColor: Theme.of(context).colorScheme.onSurfaceVariant,
                        title: 'カテゴリ',
                        subtitle: '${categories.length}件',
                        onTap: () => context.push('/categories'),
                      ),
                      const Divider(height: 1, indent: 56),
                      _SettingsTile(
                        icon: Icons.savings_outlined,
                        iconBgColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                        iconColor: Theme.of(context).colorScheme.onSurfaceVariant,
                        title: '予算設定',
                        subtitle: '月別予算の管理',
                        onTap: () => context.push('/budget'),
                      ),
                      const Divider(height: 1, indent: 56),
                      _SettingsTile(
                        icon: Icons.repeat,
                        iconBgColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                        iconColor: Theme.of(context).colorScheme.onSurfaceVariant,
                        title: '定期支出',
                        subtitle: '${recurring.length}件',
                        onTap: () => context.push('/recurring'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── セキュリティセクション ──
                const _SectionLabel('セキュリティ'),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _SettingsTile(
                    icon: passcode.enabled ? Icons.lock : Icons.lock_open_outlined,
                    iconBgColor: const Color(0xFFFEF2F2), // rose-50
                    iconColor: const Color(0xFFE11D48), // rose-600
                    title: 'パスコードロック',
                    subtitle: passcode.enabled
                        ? '有効（タップで解除）'
                        : '無効（タップで4桁PINを設定）',
                    onTap: _togglePasscode,
                  ),
                ),
                const SizedBox(height: 16),

                // ── バージョン情報セクション ──
                const _SectionLabel('バージョン情報'),
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [Color(0xFF6366F1), Color(0xFF7C3AED)],
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Text('📒', style: TextStyle(fontSize: 26)),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('家計簿',
                                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                          fontWeight: FontWeight.bold,
                                        )),
                                const SizedBox(height: 2),
                                Text('シンプルな支出管理アプリ',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                                        )),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const Divider(),
                        ...[
                          ('バージョン', '1.1.0'),
                          ('ビルド', '2026.07'),
                          ('プラットフォーム', 'Flutter'),
                          ('データ保存', 'Isar（ローカル）'),
                        ].map(
                          (row) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(row.$1,
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                                        )),
                                Text(row.$2,
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          fontWeight: FontWeight.w600,
                                        )),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Center(
                          child: Text(
                            '© 2025 Kakeibo App',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.outlineVariant,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              letterSpacing: 0.5,
            ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final Color iconBgColor;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: iconBgColor,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: iconColor),
      ),
      title: Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
      trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.outlineVariant),
    );
  }
}
