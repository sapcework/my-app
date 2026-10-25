import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../providers/expense_providers.dart';
import '../providers/repository_providers.dart';

class MonthSwitcherBar extends ConsumerWidget { // ホーム・支出・統計・予算で共用する月切り替え。Web版と同じくタイトルと同じ行の右側（AppBar.actions）に置く
  const MonthSwitcherBar({super.key});

  static final _arrowStyle = IconButton.styleFrom( // 幅だけ48→40に詰める。高さ48は残して押しやすさを保つ
    minimumSize: const Size(40, 48),
    padding: EdgeInsets.zero,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );

  static Future<void> _showMonthPicker(BuildContext context, WidgetRef ref) async {
    final months = await ref.read(expenseRepositoryProvider).getAvailableMonths();
    if (!context.mounted || months.isEmpty) return;

    final selected = ref.read(selectedMonthProvider);
    await showModalBottomSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('年月を選択', style: Theme.of(ctx).textTheme.titleMedium),
          ),
          const Divider(height: 1),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: months.length,
              itemBuilder: (_, i) {
                final m = months[i];
                final isSelected = m.year == selected.year && m.month == selected.month;
                return ListTile(
                  title: Text(DateFormat('yyyy年M月').format(m)),
                  trailing: isSelected ? const Icon(Icons.check) : null,
                  onTap: () {
                    ref.read(selectedMonthProvider.notifier).state = m;
                    Navigator.pop(ctx);
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final month = ref.watch(selectedMonthProvider);
    final now = DateTime.now();
    final isCurrentMonth = month.year == now.year && month.month == now.month;

    return Row(
      mainAxisSize: MainAxisSize.min, // タイトルの横に収まるよう幅を詰める（幅360dpの端末でも1行に入る）
      children: [
        IconButton(
          tooltip: '前の月',
          style: _arrowStyle,
          icon: const Icon(Icons.chevron_left),
          onPressed: () {
            ref.read(selectedMonthProvider.notifier).state =
                DateTime(month.year, month.month - 1); // Dartが年またぎを自動処理
          },
        ),
        TextButton(
          style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
          onPressed: () => _showMonthPicker(context, ref),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                DateFormat('yyyy年M月').format(month),
                style: Theme.of(context).textTheme.titleSmall, // titleMedium だと幅360dpの予算設定（戻る矢印あり）でタイトルが切れる
              ),
              const SizedBox(width: 2),
              const Icon(Icons.arrow_drop_down, size: 20),
            ],
          ),
        ),
        IconButton(
          tooltip: '次の月',
          style: _arrowStyle,
          icon: const Icon(Icons.chevron_right),
          onPressed: isCurrentMonth
              ? null // 今月より未来には進めない
              : () {
                  ref.read(selectedMonthProvider.notifier).state =
                      DateTime(month.year, month.month + 1);
                },
        ),
      ],
    );
  }
}
