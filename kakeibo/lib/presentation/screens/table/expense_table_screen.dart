import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/category.dart';
import '../../providers/expense_providers.dart';
import '../../providers/expense_table_provider.dart';
import '../stats/category_expense_list_screen.dart';

// セルサイズ定数
const double _catWidth = 88.0;
const double _cellW = 84.0;
const double _cellH = 44.0;
const double _headerH = 56.0;

class ExpenseTableScreen extends ConsumerWidget {
  const ExpenseTableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(expenseTableDataProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('月別支出表')),
      body: dataAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (data) => data.categories.isEmpty || data.months.isEmpty
            ? const Center(child: Text('データがありません'))
            : _TableBody(data: data),
      ),
    );
  }
}

class _TableBody extends ConsumerStatefulWidget {
  final ExpenseTableData data;
  const _TableBody({required this.data});

  @override
  ConsumerState<_TableBody> createState() => _TableBodyState();
}

class _TableBodyState extends ConsumerState<_TableBody> {
  final _hHeaderCtrl = ScrollController();
  final _hDataCtrl = ScrollController();
  final _vCatCtrl = ScrollController();
  final _vDataCtrl = ScrollController();

  bool _hSyncing = false;
  bool _vSyncing = false;

  @override
  void dispose() {
    _hHeaderCtrl.dispose();
    _hDataCtrl.dispose();
    _vCatCtrl.dispose();
    _vDataCtrl.dispose();
    super.dispose();
  }

  bool _onHeaderHScroll(ScrollNotification n) {
    if (n is ScrollUpdateNotification && !_hSyncing) {
      _hSyncing = true;
      if (_hDataCtrl.hasClients) _hDataCtrl.jumpTo(_hHeaderCtrl.offset);
      _hSyncing = false;
    }
    return false;
  }

  bool _onDataHScroll(ScrollNotification n) {
    if (n is ScrollUpdateNotification && !_hSyncing) {
      _hSyncing = true;
      if (_hHeaderCtrl.hasClients) _hHeaderCtrl.jumpTo(_hDataCtrl.offset);
      _hSyncing = false;
    }
    return false;
  }

  bool _onCatVScroll(ScrollNotification n) {
    if (n is ScrollUpdateNotification && !_vSyncing) {
      _vSyncing = true;
      if (_vDataCtrl.hasClients) _vDataCtrl.jumpTo(_vCatCtrl.offset);
      _vSyncing = false;
    }
    return false;
  }

  bool _onDataVScroll(ScrollNotification n) {
    if (n is ScrollUpdateNotification && !_vSyncing) {
      _vSyncing = true;
      if (_vCatCtrl.hasClients) _vCatCtrl.jumpTo(_vDataCtrl.offset);
      _vSyncing = false;
    }
    return false;
  }

  void _onCellTap({
    required DateTime month,
    required int? categoryId,
    required String categoryName,
    required int colorValue,
  }) {
    // 選択月を更新してからリスト画面へ遷移
    ref.read(selectedMonthProvider.notifier).state = month;

    if (categoryId == null) {
      // 合計行：月の全支出一覧
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _MonthAllExpenseListScreen(month: month),
        ),
      );
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CategoryExpenseListScreen(
            args: CategoryExpenseListArgs(
              categoryId: categoryId,
              categoryName: categoryName,
              colorValue: colorValue,
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final fmt = NumberFormat('#,##0');
    final cs = Theme.of(context).colorScheme;

    final totalCols = data.months.length + 2; // 月 + 予算 + 平均
    final totalDataWidth = totalCols * _cellW;
    final totalRows = data.categories.length + 1; // カテゴリ + 合計行

    return Column(
      children: [
        // ── ヘッダー行（上固定） ──
        SizedBox(
          height: _headerH,
          child: Row(
            children: [
              _cell(
                w: _catWidth, h: _headerH,
                color: cs.surfaceContainerHigh,
                child: Text('分類', style: _headerStyle(cs)),
              ),
              Expanded(
                child: NotificationListener<ScrollNotification>(
                  onNotification: _onHeaderHScroll,
                  child: SingleChildScrollView(
                    controller: _hHeaderCtrl,
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        ...data.months.map((m) => _cell(
                              w: _cellW, h: _headerH,
                              color: cs.surfaceContainerHigh,
                              child: Text(
                                '${m.month}月\n${m.year}',
                                textAlign: TextAlign.center,
                                style: _headerStyle(cs, fontSize: 11),
                              ),
                            )),
                        _cell(
                          w: _cellW, h: _headerH,
                          color: cs.secondaryContainer,
                          child: Text('予算',
                              style: _headerStyle(cs,
                                  color: cs.onSecondaryContainer)),
                        ),
                        _cell(
                          w: _cellW, h: _headerH,
                          color: cs.tertiaryContainer,
                          child: Text('平均',
                              style: _headerStyle(cs,
                                  color: cs.onTertiaryContainer)),
                        ),
                        // 右端の余白（スクロール端をわかりやすく）
                        const SizedBox(width: _cellW * 0.2),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        // ── データ本体 ──
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // カテゴリ列（縦スクロール）
              SizedBox(
                width: _catWidth,
                child: NotificationListener<ScrollNotification>(
                  onNotification: _onCatVScroll,
                  child: ListView.builder(
                    controller: _vCatCtrl,
                    itemCount: totalRows,
                    itemExtent: _cellH,
                    itemBuilder: (_, i) {
                      final isTotal = i == data.categories.length;
                      final cat = isTotal ? null : data.categories[i];
                      final bg = _rowBg(cs, i, isTotal);
                      return _cell(
                        w: _catWidth, h: _cellH,
                        color: bg,
                        child: Row(
                          children: [
                            if (cat != null)
                              Container(width: 4, height: _cellH, color: Color(cat.colorValue)),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 6),
                                child: Text(
                                  isTotal ? '合計' : (cat?.name ?? ''),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
              // データグリッド（縦横スクロール）
              Expanded(
                child: NotificationListener<ScrollNotification>(
                  onNotification: _onDataHScroll,
                  child: SingleChildScrollView(
                    controller: _hDataCtrl,
                    scrollDirection: Axis.horizontal,
                    child: SizedBox(
                      width: totalDataWidth + _cellW * 0.2,
                      child: NotificationListener<ScrollNotification>(
                        onNotification: _onDataVScroll,
                        child: ListView.builder(
                          controller: _vDataCtrl,
                          itemCount: totalRows,
                          itemExtent: _cellH,
                          itemBuilder: (context, rowIdx) {
                            final isTotal = rowIdx == data.categories.length;
                            final cat = isTotal ? null : data.categories[rowIdx];
                            final bg = _rowBg(cs, rowIdx, isTotal);

                            return Row(
                              children: [
                                // 月別データセル
                                ...data.months.map((m) {
                                  final amt = isTotal
                                      ? data.monthTotal(m)
                                      : (cat?.id != null ? data.amount(cat!.id!, m) : 0.0);
                                  final budget = isTotal ? data.budget(m) : null;
                                  final isOver = budget != null && amt > budget;
                                  final canTap = amt > 0;

                                  return _DataCell(
                                    w: _cellW, h: _cellH,
                                    bgColor: bg,
                                    amount: amt,
                                    isOver: isOver,
                                    isBold: isTotal,
                                    fmt: fmt,
                                    onTap: canTap
                                        ? () => _onCellTap(
                                              month: m,
                                              categoryId: isTotal ? null : cat?.id,
                                              categoryName: isTotal ? '全支出' : (cat?.name ?? ''),
                                              colorValue: isTotal
                                                  ? cs.primary.toARGB32()
                                                  : (cat?.colorValue ?? 0xFF9E9E9E),
                                            )
                                        : null,
                                  );
                                }),
                                // 予算列
                                _cell(
                                  w: _cellW, h: _cellH,
                                  color: cs.secondaryContainer.withValues(alpha: isTotal ? 1.0 : 0.25),
                                  child: _BudgetCell(data: data, cat: cat, isTotal: isTotal, cs: cs, fmt: fmt),
                                ),
                                // 平均列
                                _cell(
                                  w: _cellW, h: _cellH,
                                  color: cs.tertiaryContainer.withValues(alpha: isTotal ? 1.0 : 0.5),
                                  child: _AverageCell(data: data, cat: cat, isTotal: isTotal, cs: cs, fmt: fmt),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Color _rowBg(ColorScheme cs, int i, bool isTotal) {
    if (isTotal) return cs.surfaceContainerHigh;
    return i.isEven ? cs.surface : cs.surfaceContainerLowest;
  }

  TextStyle _headerStyle(ColorScheme cs, {Color? color, double fontSize = 12}) {
    return TextStyle(
      fontWeight: FontWeight.bold,
      fontSize: fontSize,
      color: color ?? cs.onSurface,
    );
  }
}

// ─── 小さいウィジェット群 ───

Widget _cell({
  required double w,
  required double h,
  required Color color,
  required Widget child,
}) {
  return Container(
    width: w,
    height: h,
    decoration: BoxDecoration(
      color: color,
      border: Border.all(color: Colors.black12, width: 0.5),
    ),
    alignment: Alignment.center,
    child: child,
  );
}

class _DataCell extends StatelessWidget {
  final double w, h;
  final Color bgColor;
  final double amount;
  final bool isOver, isBold;
  final NumberFormat fmt;
  final VoidCallback? onTap;

  const _DataCell({
    required this.w, required this.h,
    required this.bgColor,
    required this.amount,
    required this.isOver,
    required this.isBold,
    required this.fmt,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      width: w, height: h,
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: Colors.black12, width: 0.5),
      ),
      child: InkWell(
        onTap: onTap,
        child: Center(
          child: Text(
            amount > 0 ? '¥${fmt.format(amount)}' : '---',
            style: TextStyle(
              fontSize: 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: amount > 0
                  ? (isOver ? Colors.red : cs.onSurface)
                  : cs.onSurface.withValues(alpha: 0.3),
            ),
          ),
        ),
      ),
    );
  }
}

class _BudgetCell extends StatelessWidget {
  final ExpenseTableData data;
  final Category? cat;
  final bool isTotal;
  final ColorScheme cs;
  final NumberFormat fmt;

  const _BudgetCell({
    required this.data, required this.cat,
    required this.isTotal, required this.cs, required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    if (!isTotal) {
      return Text('---', style: TextStyle(fontSize: 11, color: cs.onSurface.withValues(alpha: 0.3)));
    }
    // 合計行：設定済み月の予算平均を表示
    final budgetMonths = data.months.where((m) => data.budget(m) != null).toList();
    if (budgetMonths.isEmpty) {
      return Text('未設定', style: TextStyle(fontSize: 10, color: cs.onSecondaryContainer));
    }
    final avg = budgetMonths.fold<double>(0, (s, m) => s + data.budget(m)!) / budgetMonths.length;
    return Text(
      '¥${fmt.format(avg)}',
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: cs.onSecondaryContainer),
    );
  }
}

class _AverageCell extends StatelessWidget {
  final ExpenseTableData data;
  final Category? cat;
  final bool isTotal;
  final ColorScheme cs;
  final NumberFormat fmt;

  const _AverageCell({
    required this.data, required this.cat,
    required this.isTotal, required this.cs, required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    final avg = isTotal
        ? data.totalAverage()
        : (cat?.id != null ? data.categoryAverage(cat!.id!) : 0);
    if (avg == 0) {
      return Text('---', style: TextStyle(fontSize: 11, color: cs.onSurface.withValues(alpha: 0.3)));
    }
    return Text(
      '¥${fmt.format(avg)}',
      style: TextStyle(
        fontSize: 11,
        fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
        color: isTotal ? cs.onTertiaryContainer : cs.onSurface,
      ),
    );
  }
}

// ─── 月の全支出一覧画面（合計行タップ時） ───
class _MonthAllExpenseListScreen extends ConsumerWidget {
  final DateTime month;
  const _MonthAllExpenseListScreen({required this.month});

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(selectedMonthExpensesProvider);
    final fmt = NumberFormat('#,##0');

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('全支出'),
            Text(
              DateFormat('yyyy年M月').format(month),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: expensesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e')),
        data: (expenses) {
          if (expenses.isEmpty) {
            return const Center(child: Text('この月の支出はありません'));
          }
          final total = expenses.fold<double>(0, (s, e) => s + e.amount);
          return Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${expenses.length}件'),
                    Text('合計 ¥${fmt.format(total)}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: expenses.length,
                  itemBuilder: (ctx, i) {
                    final e = expenses[i];
                    final wd = _weekdays[e.date.weekday - 1];
                    final dateStr = '${DateFormat('M/d').format(e.date)}($wd)';
                    final title = e.itemName?.isNotEmpty == true
                        ? e.itemName!
                        : e.memo?.isNotEmpty == true
                            ? e.memo!
                            : '支出';
                    return ListTile(
                      leading: Text(dateStr,
                          style: Theme.of(ctx).textTheme.bodySmall),
                      title: Text(title),
                      trailing: Text('¥${fmt.format(e.amount)}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      onTap: () => context.push('/expenses/${e.id}/edit'),
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
}
