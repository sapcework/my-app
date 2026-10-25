import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/usecases/expense/search_expenses.dart';
import '../../providers/category_providers.dart';
import '../../providers/search_providers.dart';
import '../../widgets/japanese_date_picker.dart';

class SearchScreen extends ConsumerStatefulWidget { // 検索タブ：条件を入れて「検索する」で結果画面へ進む
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _minCtrl = TextEditingController();
  final _maxCtrl = TextEditingController();
  final _itemCtrl = TextEditingController();
  final _memoCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadControllers(ref.read(searchConditionProvider)); // タブを移って戻っても入力欄に条件を戻す
  }

  @override
  void dispose() {
    _minCtrl.dispose();
    _maxCtrl.dispose();
    _itemCtrl.dispose();
    _memoCtrl.dispose();
    super.dispose();
  }

  void _loadControllers(SearchCondition c) {
    _minCtrl.text = c.minAmount?.toStringAsFixed(0) ?? '';
    _maxCtrl.text = c.maxAmount?.toStringAsFixed(0) ?? '';
    _itemCtrl.text = c.itemKeyword;
    _memoCtrl.text = c.memoKeyword;
  }

  void _update(SearchCondition Function(SearchCondition c) change) {
    final notifier = ref.read(searchConditionProvider.notifier);
    notifier.state = change(notifier.state);
  }

  void _clear() {
    ref.read(searchConditionProvider.notifier).state = const SearchCondition();
    _loadControllers(const SearchCondition());
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final c = ref.read(searchConditionProvider);
    final current = isFrom ? c.from : c.to;
    final picked = await showJapaneseDatePicker( // 日曜・祝日を赤、土曜を青で表示する日本語のカレンダー
      context: context,
      initialDate: current ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    _update((c) => isFrom ? c.copyWith(from: () => picked) : c.copyWith(to: () => picked));
  }

  @override
  Widget build(BuildContext context) {
    final c = ref.watch(searchConditionProvider);
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const [];
    final theme = Theme.of(context);
    final noCategory = categories.isNotEmpty && categories.every((cat) => c.excludedCategoryIds.contains(cat.id));
    final error = c.error ?? (noCategory ? '分類が1つも選ばれていません' : null);

    return Scaffold(
      appBar: AppBar(title: const Text('検索')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Section(
            label: '日付',
            child: Column( // 横に2つ並べると幅の狭い端末で日付が2行に折り返したので、縦に並べる
              children: [
                _RangeRow(
                  suffix: 'から',
                  child: _DateField(hint: '開始日', value: c.from, onTap: () => _pickDate(isFrom: true), onClear: () => _update((c) => c.copyWith(from: () => null))),
                ),
                const SizedBox(height: 8),
                _RangeRow(
                  suffix: 'まで',
                  child: _DateField(hint: '終了日', value: c.to, onTap: () => _pickDate(isFrom: false), onClear: () => _update((c) => c.copyWith(to: () => null))),
                ),
              ],
            ),
          ),
          _Section(
            label: '金額',
            child: Column( // 横に2つ並べると大きな金額が欄からはみ出したので、縦に並べる
              children: [
                _RangeRow(
                  suffix: '円以上',
                  child: _AmountField(controller: _minCtrl, hint: '最低額', onChanged: (v) => _update((c) => c.copyWith(minAmount: () => v))),
                ),
                const SizedBox(height: 8),
                _RangeRow(
                  suffix: '円以下',
                  child: _AmountField(controller: _maxCtrl, hint: '最高額', onChanged: (v) => _update((c) => c.copyWith(maxAmount: () => v))),
                ),
              ],
            ),
          ),
          _Section(
            label: '分類',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(onPressed: () => _update((c) => c.copyWith(excludedCategoryIds: {})), child: const Text('すべて選択')),
                TextButton(
                  onPressed: () => _update((c) => c.copyWith(excludedCategoryIds: {for (final cat in categories) if (cat.id != null) cat.id!})),
                  child: const Text('すべて解除'),
                ),
              ],
            ),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final cat in categories)
                  FilterChip(
                    label: Text(cat.name),
                    avatar: CircleAvatar(backgroundColor: Color(cat.colorValue), radius: 6),
                    showCheckmark: false,
                    selected: !c.excludedCategoryIds.contains(cat.id),
                    onSelected: cat.id == null
                        ? null
                        : (on) => _update((c) => c.copyWith(
                              excludedCategoryIds: on ? ({...c.excludedCategoryIds}..remove(cat.id)) : {...c.excludedCategoryIds, cat.id!},
                            )),
                  ),
              ],
            ),
          ),
          _Section(
            label: '項目名',
            child: _KeywordField(
              controller: _itemCtrl,
              mode: c.itemMode,
              onChanged: (v) => _update((c) => c.copyWith(itemKeyword: v)),
              onModeChanged: (m) => _update((c) => c.copyWith(itemMode: m)),
            ),
          ),
          _Section(
            label: 'メモ',
            child: _KeywordField(
              controller: _memoCtrl,
              mode: c.memoMode,
              onChanged: (v) => _update((c) => c.copyWith(memoKeyword: v)),
              onModeChanged: (m) => _update((c) => c.copyWith(memoMode: m)),
            ),
          ),
          _Section(
            label: '順序',
            child: DropdownButton<SearchSort>(
              value: c.sort,
              isExpanded: true,
              underline: const SizedBox.shrink(),
              items: [for (final s in SearchSort.values) DropdownMenuItem(value: s, child: Text(s.label))],
              onChanged: (s) {
                if (s != null) _update((c) => c.copyWith(sort: s));
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(error, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
                ),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: _clear, child: const Text('条件をクリア'))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: error != null ? null : () => context.push('/search/results'),
                      icon: const Icon(Icons.search),
                      label: const Text('検索する'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget { // 設定画面と同じ角丸カードに見出しを付けた1項目
  final String label;
  final Widget child;
  final Widget? trailing;
  const _Section({required this.label, required this.child, this.trailing});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 40,
                child: Row(
                  children: [
                    Text(label, style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.primary)),
                    const Spacer(),
                    if (trailing != null) trailing!,
                  ],
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class _RangeRow extends StatelessWidget { // 入力欄の右に「から」「まで」「円以上」などを添える
  final String suffix;
  final Widget child;
  const _RangeRow({required this.suffix, required this.child});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: child),
        SizedBox(width: 56, child: Padding(padding: const EdgeInsets.only(left: 8), child: Text(suffix))), // 幅をそろえて入力欄の右端を合わせる
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  final String hint;
  final DateTime? value;
  final VoidCallback onTap;
  final VoidCallback onClear;
  const _DateField({required this.hint, required this.value, required this.onTap, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: InputDecorator(
        isEmpty: value == null,
        decoration: InputDecoration(
          hintText: hint,
          isDense: true,
          border: const OutlineInputBorder(),
          suffixIcon: value == null
              ? const Icon(Icons.calendar_today_outlined, size: 18)
              : IconButton(icon: const Icon(Icons.close, size: 18), tooltip: '$hintを消す', onPressed: onClear),
        ),
        child: Text(value == null ? '' : '${DateFormat('yyyy/MM/dd').format(value!)}(${_weekdays[value!.weekday % 7]})', maxLines: 1, softWrap: false),
      ),
    );
  }
}

const _weekdays = ['日', '月', '火', '水', '木', '金', '土'];

class _AmountField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final ValueChanged<double?> onChanged;
  const _AmountField({required this.controller, required this.hint, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(12)], // 円単位の整数だけ。電卓と同じく12桁まで
      decoration: InputDecoration(hintText: hint, prefixText: '¥ ', isDense: true, border: const OutlineInputBorder()),
      onChanged: (v) => onChanged(double.tryParse(v)),
    );
  }
}

class _KeywordField extends StatelessWidget { // キーワード欄と、その比べ方（全て含む・一部含む・一致・含まない）
  final TextEditingController controller;
  final KeywordMode mode;
  final ValueChanged<String> onChanged;
  final ValueChanged<KeywordMode> onModeChanged;
  const _KeywordField({required this.controller, required this.mode, required this.onChanged, required this.onModeChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'キーワード（スペースで区切って複数）',
            isDense: true,
            border: OutlineInputBorder(),
          ),
          onChanged: onChanged,
        ),
        const SizedBox(height: 8),
        Wrap( // 幅の狭い端末でもはみ出さないよう、入りきらなければ折り返す
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final m in KeywordMode.values)
              ChoiceChip(
                label: Text(m.label),
                selected: mode == m,
                showCheckmark: false,
                onSelected: (_) => onModeChanged(m),
              ),
          ],
        ),
      ],
    );
  }
}
