import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../../../core/utils/format.dart';
import '../../../../../domain/entities/category.dart';

class CategoryPieChart extends StatelessWidget {
  final List<MapEntry<int, double>> data; // categoryId → 金額（降順ソート済み）
  final Map<int, Category> categoryMap;
  final double total;
  final int? touchedIndex; // 外部から制御
  final void Function(FlTouchEvent, PieTouchResponse?) onTouch;

  const CategoryPieChart({
    super.key,
    required this.data,
    required this.categoryMap,
    required this.total,
    required this.touchedIndex,
    required this.onTouch,
  });

  @override
  Widget build(BuildContext context) {
    final sections = data.asMap().entries.map((entry) {
      final i = entry.key;
      final e = entry.value;
      final category = categoryMap[e.key];
      final color = Color(category?.colorValue ?? 0xFF9E9E9E);
      final pct = total > 0 ? e.value / total * 100 : 0.0;
      final isTouched = touchedIndex == i;

      return PieChartSectionData(
        value: e.value,
        color: color,
        // fl_chart の radius はリングの「太さ」。centerSpaceRadius(52) と足した外径が
        // 高さ220の枠の半分(110)を超えると上下が切れて凡例に重なるため 42 までに収める
        // （Web版の outerRadius 88 / innerRadius 52 と同じ見た目）
        radius: isTouched ? 42 : 36,
        title: pct >= 5 ? '${pct.toStringAsFixed(0)}%' : '',
        titleStyle: TextStyle(
          color: Colors.white,
          fontSize: isTouched ? 13 : 11,
          fontWeight: FontWeight.bold,
        ),
      );
    }).toList();

    final activeEntry =
        (touchedIndex != null && touchedIndex! < data.length) ? data[touchedIndex!] : null;
    final fmt = NumberFormat('#,##0');

    return Stack(
      alignment: Alignment.center,
      children: [
        PieChart(
          PieChartData(
            sections: sections,
            centerSpaceRadius: 52, // Web版の innerRadius と同値
            sectionsSpace: 2, // Web版の paddingAngle と同値
            pieTouchData: PieTouchData(touchCallback: onTouch),
          ),
        ),
        // ドーナツ中央ラベル：デフォルトは合計、タッチ中はそのカテゴリ情報（Web版と同じ）
        IgnorePointer(
          child: activeEntry != null
              ? _CenterLabel(
                  icon: kCategoryIconMap[categoryMap[activeEntry.key]?.iconName ?? 'more_horiz'] ??
                      Icons.category,
                  iconColor: Color(categoryMap[activeEntry.key]?.colorValue ?? 0xFF9E9E9E),
                  name: categoryMap[activeEntry.key]?.name ?? '不明',
                  amount: '¥${fmt.format(activeEntry.value)}',
                )
              : _CenterLabel(
                  label: '合計',
                  amount: formatWan(total), // デフォルト表示のみWeb版と同じ「万」省略表示
                ),
        ),
      ],
    );
  }
}

class _CenterLabel extends StatelessWidget {
  final IconData? icon;
  final Color? iconColor;
  final String? label;
  final String? name;
  final String amount;

  const _CenterLabel({
    this.icon,
    this.iconColor,
    this.label,
    this.name,
    required this.amount,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) Icon(icon, size: 18, color: iconColor),
        if (label != null)
          Text(
            label!,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: colorScheme.onSurfaceVariant),
          ),
        if (name != null)
          Text(
            name!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
          ),
        const SizedBox(height: 2),
        Text(
          amount,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}
