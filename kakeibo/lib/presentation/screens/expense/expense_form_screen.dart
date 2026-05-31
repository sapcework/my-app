import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;

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

  // 過去の項目名一覧（画面表示時に一度だけ取得）
  late final Future<List<String>> _pastItemNamesFuture;

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
    _pastItemNamesFuture = ref.read(expenseRepositoryProvider).getUniqueItemNames();
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
    super.dispose();
  }

  Future<void> _loadExpense() async {
    final expense = await ref.read(expenseRepositoryProvider).findById(_editIdInt!);
    if (expense == null || !mounted) return;
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

  // 過去の項目名をボトムシートで選択する
  Future<void> _showItemNamePicker(List<String> names) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('過去の項目名', style: Theme.of(ctx).textTheme.titleMedium),
          ),
          const Divider(height: 1),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: names.length,
              itemBuilder: (_, i) => ListTile(
                title: Text(names[i]),
                onTap: () => Navigator.pop(ctx, names[i]),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
    if (selected != null) {
      _itemNameController.text = selected;
    }
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
      await ref.read(deleteExpenseUseCaseProvider).call(_editIdInt!);
      if (mounted) context.pop();
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

    // Dropdownのvalueがitemsにないとエラーになるため、一覧に存在するIDのみ許可
    final validCategoryId =
        categories.any((c) => c.id == _selectedCategoryId) ? _selectedCategoryId : null;

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
              // 項目名フィールド（右端に過去の項目名選択ボタン）
              FutureBuilder<List<String>>(
                future: _pastItemNamesFuture,
                builder: (context, snapshot) {
                  final pastNames = snapshot.data ?? [];
                  return TextFormField(
                    controller: _itemNameController,
                    decoration: InputDecoration(
                      labelText: '項目名（任意）',
                      border: const OutlineInputBorder(),
                      suffixIcon: pastNames.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.arrow_drop_down_circle_outlined),
                              tooltip: '過去の項目名から選択',
                              onPressed: () => _showItemNamePicker(pastNames),
                            ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                // ignore: deprecated_member_use
                value: validCategoryId, // initialValueは外部state変化に追随しないため維持
                decoration: const InputDecoration(
                  labelText: 'カテゴリ',
                  border: OutlineInputBorder(),
                ),
                hint: const Text('カテゴリを選択'),
                validator: (value) => value == null ? 'カテゴリを選択してください' : null,
                items: categories.map((category) {
                  return DropdownMenuItem<int>(
                    value: category.id,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: Color(category.colorValue),
                        ),
                        const SizedBox(width: 8),
                        Text(category.name),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (value) => setState(() => _selectedCategoryId = value),
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
