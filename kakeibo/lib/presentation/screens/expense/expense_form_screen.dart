import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/constants/category_icons.dart';
import '../../../domain/entities/category.dart';
import '../../providers/category_providers.dart';
import '../../providers/expense_providers.dart';
import '../../providers/repository_providers.dart';

class ExpenseFormScreen extends ConsumerStatefulWidget {
  final String? editId;
  const ExpenseFormScreen({super.key, this.editId});

  @override
  ConsumerState<ExpenseFormScreen> createState() => _ExpenseFormScreenState();
}

class _ExpenseFormScreenState extends ConsumerState<ExpenseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _itemNameController = TextEditingController();
  final _memoController = TextEditingController();
  late final TextEditingController _dateController;

  static const _weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  String _formatDate(DateTime date) {
    final weekday = _weekdays[date.weekday - 1]; // 1=月〜7=日
    return '${DateFormat('yyyy/MM/dd').format(date)} ($weekday)';
  }

  int? _selectedCategoryId;
  DateTime _selectedDate = DateTime.now();
  bool _submitting = false;
  bool _notFound = false; // 編集対象の支出が存在しない（削除済み・不正ID）

  // 選択中カテゴリで使った項目名の履歴（使用回数の多い順）。カテゴリを選び直すたびに取り直す
  List<String> _pastItemNames = const [];
  final _itemNameFocus = FocusNode();
  final _itemNameLink = LayerLink();
  final _suggestionsController = OverlayPortalController();

  // 入力中の文字を含む候補だけに絞る（Web版と同じ・大文字小文字は無視）
  List<String> get _matchedItemNames {
    final input = _itemNameController.text.toLowerCase();
    return _pastItemNames.where((n) => n.toLowerCase().contains(input)).toList();
  }

  void _updateSuggestionVisibility() {
    final show = _itemNameFocus.hasFocus && _matchedItemNames.isNotEmpty;
    if (show != _suggestionsController.isShowing) {
      show ? _suggestionsController.show() : _suggestionsController.hide();
    }
  }

  int? get _editIdInt => widget.editId != null ? int.tryParse(widget.editId!) : null;
  bool get _isEditMode => _editIdInt != null;

  @override
  void initState() {
    super.initState();
    if (!_isEditMode) { // 新規登録時のみ選択月を考慮
      final selectedMonth = ref.read(selectedMonthProvider);
      final now = DateTime.now();
      final isCurrentMonth = selectedMonth.year == now.year && selectedMonth.month == now.month;
      if (!isCurrentMonth) {
        _selectedDate = DateTime(selectedMonth.year, selectedMonth.month, 1); // 今月以外は月初を初期値に
      }
    }
    _dateController = TextEditingController(text: _formatDate(_selectedDate));
    _itemNameFocus.addListener(_updateSuggestionVisibility);
    _reloadPastItemNames();
    if (_isEditMode) {
      // build完了後に既存データをロード（initState中のref.read保証のため）
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadExpense());
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _itemNameController.dispose();
    _memoController.dispose();
    _dateController.dispose();
    _itemNameFocus.dispose();
    super.dispose();
  }

  Future<void> _loadExpense() async {
    final expense = await ref.read(expenseRepositoryProvider).findById(_editIdInt!);
    if (!mounted) return;
    if (expense == null) { // 削除済み・不正IDならnot-found表示に切り替え
      setState(() => _notFound = true);
      return;
    }
    setState(() {
      _amountController.text = expense.amount % 1 == 0
          ? expense.amount.toInt().toString()
          : expense.amount.toStringAsFixed(2); // 小数点がある場合のみ小数を表示
      _itemNameController.text = expense.itemName ?? '';
      _selectedCategoryId = expense.categoryId;
      _selectedDate = expense.date;
      _dateController.text = _formatDate(expense.date);
      _memoController.text = expense.memo ?? '';
    });
    _reloadPastItemNames(); // 読み込んだカテゴリの履歴に切り替える
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _dateController.text = _formatDate(picked);
      });
    }
  }

  // 選択中のカテゴリで使った項目名だけを読み直す（カテゴリを変えたら履歴も変わる）
  Future<void> _reloadPastItemNames() async {
    final names = await ref
        .read(expenseRepositoryProvider)
        .getUniqueItemNames(categoryId: _selectedCategoryId);
    if (!mounted) return;
    setState(() => _pastItemNames = names);
    _updateSuggestionVisibility();
  }

  // 候補を選んだら入力欄に反映して閉じる
  void _applySuggestion(String name) {
    _itemNameController.text = name;
    _suggestionsController.hide();
    _itemNameFocus.unfocus();
  }

  Future<void> _delete() async {
    if (_editIdInt == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('削除の確認'),
        content: const Text('この支出を削除しますか？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('削除'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      final repo = ref.read(expenseRepositoryProvider);
      final messenger = ScaffoldMessenger.of(context); // pop後も使えるようpop前に取得
      final deleted = await repo.findById(_editIdInt!); // Undo用に削除前の内容を退避
      await ref.read(deleteExpenseUseCaseProvider).call(_editIdInt!);
      if (mounted) context.pop();
      if (deleted != null) {
        messenger.showSnackBar(
          SnackBar(
            content: const Text('支出を削除しました'),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: '元に戻す',
              onPressed: () => repo.save(deleted), // IDを保持したまま再登録して復元
            ),
          ),
        );
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final amount = double.parse(_amountController.text.trim());
      final itemName = _itemNameController.text.trim().isEmpty
          ? null
          : _itemNameController.text.trim();
      final memo = _memoController.text.trim().isEmpty
          ? null
          : _memoController.text.trim();

      if (_isEditMode) {
        final existing = await ref.read(expenseRepositoryProvider).findById(_editIdInt!);
        if (existing != null) {
          await ref.read(updateExpenseUseCaseProvider).call(
            existing.copyWith(
              amount: amount,
              categoryId: _selectedCategoryId!,
              itemName: itemName,
              memo: memo,
              date: _selectedDate,
            ),
          );
        }
      } else {
        await ref.read(addExpenseUseCaseProvider).call(
          amount: amount,
          categoryId: _selectedCategoryId!,
          itemName: itemName,
          memo: memo,
          date: _selectedDate,
        );
      }

      if (mounted) context.pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];

    if (_notFound) { // 編集対象が見つからない場合の表示（Web版のnot-found画面に対応）
      return Scaffold(
        appBar: AppBar(title: const Text('支出を編集')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.search_off,
                  size: 48, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 16),
              const Text('この支出は見つかりませんでした'),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go('/expenses'),
                child: const Text('支出一覧へ戻る'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? '支出を編集' : '支出を追加'),
        actions: [
          if (_isEditMode) // 編集モード時のみ削除ボタンを表示
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: _delete,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 金額フィールド：タップで電卓画面へ遷移
              GestureDetector(
                onTap: () async {
                  final current = double.tryParse(_amountController.text) ?? 0;
                  final result = await context.push<double>(
                    '/calculator',
                    extra: current > 0 ? current : null,
                  );
                  if (result != null && mounted) {
                    setState(() {
                      _amountController.text = result == result.truncateToDouble()
                          ? result.toInt().toString()
                          : result.toStringAsFixed(2);
                    });
                  }
                },
                child: AbsorbPointer(
                  child: TextFormField(
                    controller: _amountController,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: '金額',
                      suffixText: '円',
                      border: const OutlineInputBorder(),
                      suffixIcon: Icon(
                        Icons.calculate_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    validator: (value) {
                      final n = double.tryParse(value?.trim() ?? '');
                      if (n == null || n <= 0) return '正の金額を入力してください';
                      return null;
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // 項目名フィールド（入力欄の下に候補を重ねて出す。Web版と同じ挙動）
              LayoutBuilder(
                builder: (context, constraints) => CompositedTransformTarget(
                  link: _itemNameLink,
                  child: OverlayPortal(
                    controller: _suggestionsController,
                    overlayChildBuilder: (_) => _ItemNameSuggestions(
                      link: _itemNameLink,
                      width: constraints.maxWidth,
                      names: _matchedItemNames,
                      onSelected: _applySuggestion,
                    ),
                    child: TextFormField(
                      controller: _itemNameController,
                      focusNode: _itemNameFocus,
                      onChanged: (_) => setState(_updateSuggestionVisibility),
                      decoration: const InputDecoration(
                        labelText: '項目名（任意）',
                        border: OutlineInputBorder(),
                        hintText: '例：スーパーABC',
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // カテゴリ選択：Web版に合わせた4列グリッド（ドロップダウンから置換）
              FormField<int>(
                validator: (_) =>
                    _selectedCategoryId == null ? 'カテゴリを選択してください' : null,
                builder: (field) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('カテゴリ', style: Theme.of(context).textTheme.labelMedium),
                    const SizedBox(height: 8),
                    GridView.count(
                      crossAxisCount: 4,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(), // 外側のScrollViewに任せる
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 1.15,
                      children: categories.map((category) {
                        final isSelected = category.id == _selectedCategoryId;
                        final color = Color(category.colorValue);
                        return InkWell(
                          onTap: () {
                            setState(() => _selectedCategoryId = category.id);
                            field.didChange(category.id); // FormFieldのエラー表示を解消
                            _reloadPastItemNames(); // 項目名の履歴を選んだカテゴリのものに切り替える
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            decoration: BoxDecoration(
                              color: isSelected ? color.withValues(alpha: 0.15) : null,
                              border: Border.all(
                                color: isSelected
                                    ? color
                                    : Theme.of(context).colorScheme.outlineVariant,
                                width: isSelected ? 1.5 : 1,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  kCategoryIconMap[category.iconName] ?? Icons.category,
                                  color: color,
                                  size: 22,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  category.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                        fontWeight:
                                            isSelected ? FontWeight.bold : FontWeight.normal,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    if (field.hasError)
                      Padding(
                        padding: const EdgeInsets.only(top: 8, left: 4),
                        child: Text(
                          field.errorText!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _selectDate,
                child: AbsorbPointer(
                  child: TextFormField(
                    controller: _dateController,
                    decoration: const InputDecoration(
                      labelText: '日付',
                      suffixIcon: Icon(Icons.calendar_today_outlined),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _memoController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'メモ（任意）',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 32),
              FilledButton(
                onPressed: _submitting ? null : _submit, // 送信中は非活性
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('保存'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// 項目名の入力欄の下に重ねて出す候補リスト（Web版のドロップダウン相当）
class _ItemNameSuggestions extends StatelessWidget {
  final LayerLink link;
  final double width;
  final List<String> names;
  final ValueChanged<String> onSelected;

  const _ItemNameSuggestions({
    required this.link,
    required this.width,
    required this.names,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (names.isEmpty) return const SizedBox.shrink(); // 空の枠が一瞬出るのを防ぐ
    final colorScheme = Theme.of(context).colorScheme;
    return Positioned(
      width: width,
      child: CompositedTransformFollower(
        link: link,
        targetAnchor: Alignment.bottomLeft,
        followerAnchor: Alignment.topLeft,
        offset: const Offset(0, 4),
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 176), // Web版の max-h-44 と同じ
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: names.length,
                itemBuilder: (_, i) => InkWell(
                  onTap: () => onSelected(names[i]),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Text(names[i], style: Theme.of(context).textTheme.bodyMedium),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
