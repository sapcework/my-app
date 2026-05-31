import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('統計'),
        bottom: const MonthSwitcherBar(),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_outlined),
            tooltip: 'CSVエクスポート',
            onPressed: () => _exportCsv(context, ref, selectedMonth),
          ),
        ],
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

          return Column(
            children: [
              // 合計カード
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('合計支出', style: Theme.of(context).textTheme.titleSmall),
                        Text(
                          '¥${NumberFormat('#,##0').format(total)}',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // 円グラフ + 吹き出し（Stackで重ねる）
              SizedBox(
                height: 240,
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: CategoryPieChart(
                        data: sorted,
                        categoryMap: categoryMap,
                        total: total,
                        touchedIndex: _touchedIndex,
                        onTouch: (event, response) =>
                            _handlePieTouch(event, response, sorted, categoryMap),
                      ),
                    ),
                    // 吹き出し（タッチ中のみ表示）
                    if (_touchedIndex != null && _touchedIndex! < sorted.length)
                      Center(
                        child: _buildCallout(
                          sorted[_touchedIndex!],
                          categoryMap,
                          total,
                        ),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  itemCount: sorted.length,
                  itemBuilder: (context, index) {
                    final entry = sorted[index];
                    final pct = total > 0 ? entry.value / total * 100 : 0.0;
                    return InkWell(
                      onTap: () => _navigateToCategoryList(entry, categoryMap),
                      child: CategoryBreakdownTile(
                        category: categoryMap[entry.key],
                        amount: entry.value,
                        percentage: pct,
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCallout(MapEntry<int, double> entry, Map<int, Category> categoryMap, double total) {
    final category = categoryMap[entry.key];
    final color = Color(category?.colorValue ?? 0xFF9E9E9E);
    final pct = total > 0 ? entry.value / total * 100 : 0.0;
    final fmt = NumberFormat('#,##0');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            category?.name ?? '不明',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '¥${fmt.format(entry.value)}',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          Text(
            '${pct.toStringAsFixed(1)}%',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Future<void> _exportCsv(BuildContext context, WidgetRef ref, DateTime month) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final path = await ref.read(exportCsvUseCaseProvider).call(month.year, month.month);
      messenger.showSnackBar(
        SnackBar(
          content: Text('保存しました:\n$path'),
          duration: const Duration(seconds: 5),
        ),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('エクスポートに失敗しました: $e')),
      );
    }
  }
}
