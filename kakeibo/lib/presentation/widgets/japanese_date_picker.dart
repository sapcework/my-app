import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/utils/japanese_holidays.dart';

// 日本語のカレンダー。日曜・祝日・振替休日を赤、土曜を青で表示し、選んだ日と表示中の月の祝日名を出す。
// Flutter 標準の showDatePicker は日ごとの色分けができないため自前で用意している

const _weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

Future<DateTime?> showJapaneseDatePicker({
  required BuildContext context,
  required DateTime initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  return showDialog<DateTime>(
    context: context,
    builder: (_) => _JapaneseDatePickerDialog(
      initialDate: _dateOnly(initialDate),
      firstDate: _dateOnly(firstDate),
      lastDate: _dateOnly(lastDate),
    ),
  );
}

DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

String _weekdayOf(DateTime d) => _weekdayLabels[d.weekday % 7]; // DateTime.weekday は月=1〜日=7

class DayColors { // 曜日・祝日の文字色（ライト/ダークで読みやすい濃さを変える）
  final Color holiday;
  final Color saturday;
  const DayColors(this.holiday, this.saturday);

  static DayColors of(BuildContext context) => Theme.of(context).brightness == Brightness.dark
      ? const DayColors(Color(0xFFFF8A80), Color(0xFF82B1FF))
      : const DayColors(Color(0xFFD32F2F), Color(0xFF1565C0));

  Color? forDate(DateTime d) { // 祝日・日曜は赤、土曜は青、平日は null（通常の文字色）
    if (d.weekday == DateTime.sunday || japaneseHolidayName(d) != null) return holiday;
    if (d.weekday == DateTime.saturday) return saturday;
    return null;
  }
}

class _JapaneseDatePickerDialog extends StatefulWidget {
  final DateTime initialDate;
  final DateTime firstDate;
  final DateTime lastDate;
  const _JapaneseDatePickerDialog({required this.initialDate, required this.firstDate, required this.lastDate});

  @override
  State<_JapaneseDatePickerDialog> createState() => _JapaneseDatePickerDialogState();
}

class _JapaneseDatePickerDialogState extends State<_JapaneseDatePickerDialog> {
  late DateTime _selected = widget.initialDate;
  late DateTime _month = DateTime(widget.initialDate.year, widget.initialDate.month); // 表示中の月（1日）
  bool _pickingMonth = false; // true の間は年・月の一覧から選ぶ表示

  DateTime get _minMonth => DateTime(widget.firstDate.year, widget.firstDate.month);
  DateTime get _maxMonth => DateTime(widget.lastDate.year, widget.lastDate.month);
  bool _inRange(DateTime d) => !d.isBefore(widget.firstDate) && !d.isAfter(widget.lastDate);

  void _moveMonth(int delta) {
    final next = DateTime(_month.year, _month.month + delta);
    if (next.isBefore(_minMonth) || next.isAfter(_maxMonth)) return;
    setState(() => _month = next);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = DayColors.of(context);
    final holidayName = japaneseHolidayName(_selected);
    final today = _dateOnly(DateTime.now());

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding( // 選んでいる日（祝日なら名前も）
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${DateFormat('yyyy年M月d日').format(_selected)}(${_weekdayOf(_selected)})',
                      style: theme.textTheme.headlineSmall?.copyWith(color: colors.forDate(_selected)),
                    ),
                    SizedBox(
                      height: 20, // 祝日名が無い日も高さを変えない
                      child: Text(holidayName ?? '', style: theme.textTheme.bodyMedium?.copyWith(color: colors.holiday)),
                    ),
                  ],
                ),
              ),
              const Divider(),
              Row( // 月の切り替え
                children: [
                  IconButton(
                    tooltip: '前の月',
                    icon: const Icon(Icons.chevron_left),
                    onPressed: _pickingMonth || !_month.isAfter(_minMonth) ? null : () => _moveMonth(-1),
                  ),
                  Expanded(
                    child: TextButton(
                      onPressed: () => setState(() => _pickingMonth = !_pickingMonth),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(DateFormat('yyyy年M月').format(_month), style: theme.textTheme.titleMedium),
                          Icon(_pickingMonth ? Icons.arrow_drop_up : Icons.arrow_drop_down),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: '次の月',
                    icon: const Icon(Icons.chevron_right),
                    onPressed: _pickingMonth || !_month.isBefore(_maxMonth) ? null : () => _moveMonth(1),
                  ),
                ],
              ),
              _pickingMonth ? _buildMonthPicker(theme) : _buildDays(theme, colors, today),
              Row(
                children: [
                  TextButton(
                    onPressed: _inRange(today)
                        ? () => setState(() {
                              _selected = today;
                              _month = DateTime(today.year, today.month);
                              _pickingMonth = false;
                            })
                        : null,
                    child: const Text('今日'),
                  ),
                  const Spacer(),
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('キャンセル')),
                  TextButton(onPressed: () => Navigator.pop(context, _selected), child: const Text('OK')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDays(ThemeData theme, DayColors colors, DateTime today) {
    final leading = DateTime(_month.year, _month.month, 1).weekday % 7; // 1日の前の空き（日曜始まり）
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final holidays = japaneseHolidays(_month.year).entries.where((e) => e.key.month == _month.month).toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    return GestureDetector( // 左右になぞって月を切り替える
      onHorizontalDragEnd: (d) {
        final v = d.primaryVelocity ?? 0;
        if (v.abs() < 200) return;
        _moveMonth(v < 0 ? 1 : -1);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: Center(
                    child: Text(
                      _weekdayLabels[i],
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: i == 0 ? colors.holiday : (i == 6 ? colors.saturday : theme.colorScheme.onSurfaceVariant),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          for (var row = 0; row < 6; row++) // 月によって行数が変わらないよう常に6行
            Row(
              children: [
                for (var col = 0; col < 7; col++)
                  Expanded(child: _buildDayCell(theme, colors, today, row * 7 + col - leading + 1, daysInMonth)),
              ],
            ),
          SizedBox( // 表示中の月の祝日（高さを固定して、月を切り替えてもボタンの位置が動かないようにする）
            height: 56,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 0),
              children: [
                for (final MapEntry(key: d, value: name) in holidays)
                  Text(
                    '${d.day}日(${_weekdayOf(d)}) $name',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.holiday),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayCell(ThemeData theme, DayColors colors, DateTime today, int day, int daysInMonth) {
    if (day < 1 || day > daysInMonth) return const SizedBox(height: 40);
    final date = DateTime(_month.year, _month.month, day);
    final enabled = _inRange(date);
    final isSelected = date == _selected;
    final isToday = date == today;
    final textColor = !enabled
        ? theme.colorScheme.onSurface.withValues(alpha: 0.3)
        : isSelected
            ? theme.colorScheme.onPrimary
            : colors.forDate(date) ?? theme.colorScheme.onSurface;

    return SizedBox(
      height: 40,
      child: Center(
        child: InkResponse(
          onTap: enabled ? () => setState(() => _selected = date) : null,
          radius: 20,
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected ? theme.colorScheme.primary : null,
              border: isToday && !isSelected ? Border.all(color: theme.colorScheme.primary, width: 1.5) : null, // 今日は枠で示す
            ),
            child: Text(
              '$day',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: textColor,
                fontWeight: japaneseHolidayName(date) != null ? FontWeight.bold : null, // 祝日は太字にして日曜と見分ける
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMonthPicker(ThemeData theme) { // 年を左右で切り替え、月を12個のボタンから選ぶ
    final year = _month.year;
    return SizedBox(
      height: 6 * 40 + 24 + 56, // 日付の表示と同じ高さ
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                tooltip: '前の年',
                icon: const Icon(Icons.keyboard_double_arrow_left),
                onPressed: year > _minMonth.year ? () => setState(() => _month = _clampMonth(DateTime(year - 1, _month.month))) : null,
              ),
              Text('$year年', style: theme.textTheme.titleMedium),
              IconButton(
                tooltip: '次の年',
                icon: const Icon(Icons.keyboard_double_arrow_right),
                onPressed: year < _maxMonth.year ? () => setState(() => _month = _clampMonth(DateTime(year + 1, _month.month))) : null,
              ),
            ],
          ),
          Expanded(
            child: GridView.count(
              crossAxisCount: 4,
              childAspectRatio: 1.8,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (var m = 1; m <= 12; m++)
                  Builder(builder: (context) {
                    final target = DateTime(year, m);
                    final enabled = !target.isBefore(_minMonth) && !target.isAfter(_maxMonth);
                    final current = m == _month.month;
                    final style = ButtonStyle(padding: WidgetStateProperty.all(EdgeInsets.zero)); // 幅の狭い端末でも「12月」が1行に収まるように
                    return Padding(
                      padding: const EdgeInsets.all(4),
                      child: current
                          ? FilledButton(style: style, onPressed: () => setState(() => _pickingMonth = false), child: Text('$m月'))
                          : OutlinedButton(
                              style: style,
                              onPressed: enabled
                                  ? () => setState(() {
                                        _month = target;
                                        _pickingMonth = false;
                                      })
                                  : null,
                              child: Text('$m月'),
                            ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  DateTime _clampMonth(DateTime m) => m.isBefore(_minMonth) ? _minMonth : (m.isAfter(_maxMonth) ? _maxMonth : m);
}
