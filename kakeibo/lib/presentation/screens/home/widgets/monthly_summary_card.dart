import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class MonthlySummaryCard extends StatelessWidget {
  final double total;
  final int count;
  final DateTime month;
  final double? budget;

  const MonthlySummaryCard({
    super.key,
    required this.total,
    required this.count,
    required this.month,
    this.budget,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final fmt = NumberFormat('#,##0');

    final hasBudget = budget != null && budget! > 0;
    final remaining = hasBudget ? budget! - total : 0.0;
    final progress = hasBudget ? (total / budget!).clamp(0.0, 1.0) : 0.0;
    final isOver = hasBudget && total > budget!;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // グラデーション上部アクセントバー（Web版の h-1 gradient bar に対応）
          Container(
            height: 4,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFA855F7)],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '今月の支出',
                            style: textTheme.labelSmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '¥${fmt.format(total)}',
                            style: textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$count件の取引',
                            style: textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // 予算バッジ（Web版の emerald/rose badge に対応）
                    if (hasBudget)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isOver
                              ? Colors.red.shade50
                              : Colors.green.shade50,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isOver ? Icons.warning_rounded : Icons.trending_up,
                              size: 13,
                              color: isOver ? Colors.red.shade600 : Colors.green.shade600,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isOver
                                  ? '¥${fmt.format(-remaining)} 超過'
                                  : '残り ¥${fmt.format(remaining)}',
                              style: textTheme.labelSmall?.copyWith(
                                color: isOver ? Colors.red.shade700 : Colors.green.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                if (hasBudget) ...[
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '予算 ¥${fmt.format(budget!)}',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                      Text(
                        '${(progress * 100).toStringAsFixed(0)}%',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: colorScheme.surfaceContainerHighest,
                      color: isOver
                          ? Colors.red.shade500
                          : progress >= 0.8
                              ? Colors.amber.shade400
                              : colorScheme.primary,
                      minHeight: 6,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
