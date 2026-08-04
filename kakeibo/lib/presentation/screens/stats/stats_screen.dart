import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/file_export.dart';
import '../../../core/utils/format.dart';
import '../../../../domain/entities/category.dart';
import '../../providers/category_providers.dart';
import '../../providers/expense_providers.dart';
import '../../widgets/month_switcher_bar.dart';
import 'category_expense_list_screen.dart';
import 'widgets/category_breakdown_tile.dart';
import 'widgets/category_pie_chart.dart';

class StatsScreen extends ConsumerStatefulWidget {
  const StatsScreen({super.key});

  @override
  ConsumerState<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends ConsumerState<StatsScreen> {
  int? _touchedIndex;
  // タップ開始時のインデックスを記録し、離した時にナビゲート
  int? _tapStartIndex;

  void _handlePieTouch(
    FlTouchEvent event,
    PieTouchResponse? response,
    List<MapEntry<int, double>> sorted,
    Map<int, Category> categoryMap,
  ) {
    final sectionIndex = response?.touchedSection?.touchedSectionIndex;

    if (event is FlTapDownEvent && sectionIndex != null && sectionIndex >= 0) {
      setState(() {
        _touchedIndex = sectionIndex;
        _tapStartIndex = sectionIndex;
      });
    } else if (event is FlTapUpEvent) {
      final idx = _tapStartIndex;
      setState(() {
        _touchedIndex = null;
        _tapStartIndex = null;
      });
      if (idx != null && idx >= 0 && idx < sorted.length) {
        _navigateToCategoryList(sorted[idx], categoryMap);
      }
    } else if (!event.isInterestedForInteractions) {
      setState(() {
        _touchedIndex = null;
        _tapStartIndex = null;
      });
    }
  }

  void _navigateToCategoryList(MapEntry<int, double> entry, Map<int, Category> categoryMap) {
    final category = categoryMap[entry.key];
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CategoryExpenseListScreen(
          args: CategoryExpenseListArgs(
            categoryId: entry.key,
            categoryName: category?.name ?? '不明',
            colorValue: category?.colorValue ?? 0xFF9E9E9E,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final expensesAsync = ref.watch(selectedMonthExpensesProvider);
    final selectedMonth = ref.watch(selectedMonthProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final categoryMap = {for (final c in categories) if (c.id != null) c.id!: c};
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('統計'),
        bottom: const MonthSwitcherBar(),
      ),
      body: expensesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (expenses) {
          if (expenses.isEmpty) {
            return const Center(child: Text('この月の支出はありません'));
          }

          final totals = <int, double>{};
          for (final e in expenses) {
            totals[e.categoryId] = (totals[e.categoryId] ?? 0) + e.amount;
          }
          final total = totals.values.fold<double>(0, (s, v) => s + v);
          final sorted = totals.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value));

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // 合計カード + CSV出力ボタン（Web版と同じくカード内に配置）
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '今月の合計',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                  letterSpacing: 0.5,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            formatWan(total), // Web版と同じく1万円以上は「¥1.7万」のように省略表示
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                        ],
                      ),
                      TextButton.icon(
                        onPressed: () => _exportCsv(context, ref, selectedMonth),
                        icon: const Icon(Icons.download_outlined, size: 16),
                        label: const Text('CSV出力'),
                        style: TextButton.styleFrom(
                          backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.5),
                          foregroundColor: colorScheme.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 円グラフ + カテゴリ凡例（Web版と同じくグラフの直下に凡例グリッドを表示）
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      SizedBox(
                        height: 220,
                        child: CategoryPieChart(
                          data: sorted,
                          categoryMap: categoryMap,
                          total: total,
                          touchedIndex: _touchedIndex,
                          onTouch: (event, response) =>
                              _handlePieTouch(event, response, sorted, categoryMap),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // 2列凡例グリッド（カード内の実幅を基準に算出。デスクトップの広いウィンドウでも崩れないようLayoutBuilderを使用）
                      LayoutBuilder(
                        builder: (context, constraints) {
                          const spacing = 16.0;
                          final itemWidth = (constraints.maxWidth - spacing) / 2;
                          return Wrap(
                            spacing: spacing,
                            runSpacing: 8,
                            children: sorted.map((entry) {
                              final category = categoryMap[entry.key];
                              final pct = total > 0 ? entry.value / total * 100 : 0.0;
                              return SizedBox(
                                width: itemWidth,
                                child: InkWell(
                                  onTap: () => _navigateToCategoryList(entry, categoryMap),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 10,
                                        height: 10,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: Color(category?.colorValue ?? 0xFF9E9E9E),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          category?.name ?? '不明',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context).textTheme.bodySmall,
                                        ),
                                      ),
                                      Text(
                                        '${pct.toStringAsFixed(0)}%',
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                              fontWeight: FontWeight.w600,
                                              color: colorScheme.onSurfaceVariant,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // カテゴリ別カードリスト
              ...sorted.map((entry) {
                final pct = total > 0 ? entry.value / total * 100 : 0.0;
                return CategoryBreakdownTile(
                  category: categoryMap[entry.key],
                  amount: entry.value,
                  percentage: pct,
                  onTap: () => _navigateToCategoryList(entry, categoryMap),
                );
              }),
            ],
          );
        },
      ),
    );
  }

  Future<void> _exportCsv(BuildContext context, WidgetRef ref, DateTime month) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final path = await ref.read(exportCsvUseCaseProvider).call(month.year, month.month);
      if (!context.mounted) return;
      await notifyExported(context, path);
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('エクスポートに失敗しました: $e')),
      );
    }
  }
}
