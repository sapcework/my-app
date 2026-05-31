import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

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
        radius: isTouched ? 95 : 80, // タッチ時に拡大
        title: pct >= 5 ? '${pct.toStringAsFixed(0)}%' : '',
        titleStyle: TextStyle(
          color: Colors.white,
          fontSize: isTouched ? 13 : 11,
          fontWeight: FontWeight.bold,
        ),
      );
    }).toList();

    return PieChart(
      PieChartData(
        sections: sections,
        centerSpaceRadius: 50,
        sectionsSpace: 3,
        pieTouchData: PieTouchData(touchCallback: onTouch),
      ),
    );
  }
}
