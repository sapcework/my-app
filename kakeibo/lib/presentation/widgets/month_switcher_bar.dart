import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../providers/expense_providers.dart';
import '../providers/repository_providers.dart';

// 支出一覧・統計画面で共用する月切り替えバー
// AppBar.bottom に配置するため PreferredSizeWidget を実装
class MonthSwitcherBar extends ConsumerWidget implements PreferredSizeWidget {
  const MonthSwitcherBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(48);

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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left),
          onPressed: () {
            ref.read(selectedMonthProvider.notifier).state =
                DateTime(month.year, month.month - 1); // Dartが年またぎを自動処理
          },
        ),
        TextButton(
          onPressed: () => _showMonthPicker(context, ref),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                DateFormat('yyyy年M月').format(month),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(width: 2),
              const Icon(Icons.arrow_drop_down, size: 20),
            ],
          ),
        ),
        IconButton(
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
