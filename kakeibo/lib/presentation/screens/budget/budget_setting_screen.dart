import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/budget_providers.dart';
import '../../providers/expense_providers.dart';
import '../../widgets/month_switcher_bar.dart';

// Web版 BudgetPage に対応：選択月は他画面と共有（selectedMonthProvider）で、
// 月を切り替えるたびその月の予算をフォームへ読み込み、保存後もページに留まって進捗を表示する
class BudgetSettingScreen extends ConsumerStatefulWidget {
  const BudgetSettingScreen({super.key});

  @override
  ConsumerState<BudgetSettingScreen> createState() => _BudgetSettingScreenState();
}

class _BudgetSettingScreenState extends ConsumerState<BudgetSettingScreen> {
  final _amountController = TextEditingController();
  bool _submitting = false;
  DateTime? _loadedMonth; // 直近でフォームへ反映した月（月切り替え時の再読込判定用）

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadBudgetFor(DateTime month) async {
    _loadedMonth = month;
    final budget = await ref.read(getBudgetUseCaseProvider).call(month.year, month.month);
    if (!mounted || _loadedMonth != month) return; // 読み込み中にさらに月が変わっていたら破棄
    setState(() {
      _amountController.text = (budget != null && budget.amount > 0)
          ? budget.amount.toInt().toString()
          : '';
    });
  }

  Future<void> _save(DateTime month) async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) return;
    setState(() => _submitting = true);
    try {
      await ref.read(setBudgetUseCaseProvider).call(
            year: month.year,
            month: month.month,
            amount: amount,
          );
      ref.invalidate(selectedMonthBudgetProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${DateFormat('yyyy年M月').format(month)}の予算を保存しました')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _openCalculator() async {
    final current = double.tryParse(_amountController.text) ?? 0;
    final result = await context.push<double>(
      '/calculator',
      extra: current > 0 ? current : null,
    );
    if (result != null && mounted) {
      setState(() {
        _amountController.text = result > 0 ? result.round().toString() : '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final month = ref.watch(selectedMonthProvider);
    if (_loadedMonth != month) {
      // 月切り替え直後は非同期読み込みを開始（build内では await できないため次フレームで実行）
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadBudgetFor(month));
    }

    final savedBudget = ref.watch(selectedMonthBudgetProvider).valueOrNull?.amount ?? 0;
    final total = ref.watch(selectedMonthExpensesProvider).valueOrNull?.fold<double>(
              0,
              (sum, e) => sum + e.amount,
            ) ??
        0;
    final remaining = savedBudget - total;
    final rate = savedBudget > 0 ? (total / savedBudget * 100).clamp(0, 100) : 0.0;
    final isOver = savedBudget > 0 && total > savedBudget;
    final amount = double.tryParse(_amountController.text) ?? 0;
    final fmt = NumberFormat('#,##0');
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('予算設定'),
        bottom: const MonthSwitcherBar(),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 予算入力フォーム
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${DateFormat('yyyy年M月').format(month)}の予算',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: _openCalculator,
                    child: AbsorbPointer(
                      child: TextField(
                        controller: _amountController,
                        readOnly: true,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                        decoration: InputDecoration(
                          prefixText: '¥',
                          hintText: '0',
                          border: const OutlineInputBorder(),
                          suffixIcon: Icon(Icons.calculate_outlined, color: colorScheme.primary),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: (_submitting || amount <= 0) ? null : () => _save(month),
                      child: const Text('保存する'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 進捗カード（予算設定済みの月のみ）
          if (savedBudget > 0)
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '今月の進捗',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('支出', style: Theme.of(context).textTheme.bodySmall),
                            Text('¥${fmt.format(total)}',
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    )),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('予算', style: Theme.of(context).textTheme.bodySmall),
                            Text('¥${fmt.format(savedBudget)}',
                                style: Theme.of(context).textTheme.titleMedium),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${rate.toStringAsFixed(0)}% 使用',
                            style: Theme.of(context).textTheme.bodySmall),
                        Text('残り ¥${fmt.format(remaining < 0 ? 0 : remaining)}',
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: rate / 100,
                        backgroundColor: colorScheme.surfaceContainerHighest,
                        color: isOver
                            ? Colors.red.shade500
                            : rate >= 80
                                ? Colors.amber.shade400
                                : colorScheme.primary,
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: isOver ? Colors.red.shade50 : Colors.green.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isOver ? Icons.warning_rounded : Icons.trending_up,
                            size: 16,
                            color: isOver ? Colors.red.shade600 : Colors.green.shade600,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isOver
                                ? '¥${fmt.format(-remaining)} オーバー'
                                : '残り ¥${fmt.format(remaining)}',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: isOver ? Colors.red.shade700 : Colors.green.shade700,
                                ),
                          ),
                        ],
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
