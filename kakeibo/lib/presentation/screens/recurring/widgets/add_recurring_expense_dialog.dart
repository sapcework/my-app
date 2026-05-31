import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/entities/category.dart';
import '../../../../domain/entities/recurring_expense.dart';
import '../../../providers/category_providers.dart';
import '../../../providers/recurring_expense_providers.dart';

class AddRecurringExpenseDialog extends ConsumerStatefulWidget {
  final RecurringExpense? editing; // nullなら新規追加

  const AddRecurringExpenseDialog({super.key, this.editing});

  @override
  ConsumerState<AddRecurringExpenseDialog> createState() => _AddRecurringExpenseDialogState();
}

class _AddRecurringExpenseDialogState extends ConsumerState<AddRecurringExpenseDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _amountController = TextEditingController();
  int? _selectedCategoryId;
  int _selectedDay = 1;
  bool _submitting = false;

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      final e = widget.editing!;
      _nameController.text = e.name;
      _amountController.text = e.amount.toInt().toString();
      _selectedCategoryId = e.categoryId;
      _selectedDay = e.dayOfMonth;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('カテゴリを選択してください')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final name = _nameController.text.trim();
      final amount = double.parse(_amountController.text.trim());
      if (_isEdit) {
        await ref.read(updateRecurringExpenseUseCaseProvider).call(
              widget.editing!.copyWith(
                name: name,
                amount: amount,
                categoryId: _selectedCategoryId!,
                dayOfMonth: _selectedDay,
              ),
            );
      } else {
        await ref.read(addRecurringExpenseUseCaseProvider).call(
              name: name,
              amount: amount,
              categoryId: _selectedCategoryId!,
              dayOfMonth: _selectedDay,
            );
      }
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider).valueOrNull ?? const <Category>[];
    final validCategoryId =
        categories.any((c) => c.id == _selectedCategoryId) ? _selectedCategoryId : null;

    return AlertDialog(
      title: Text(_isEdit ? '定期支出を編集' : '定期支出を追加'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: '支出名',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? '支出名を入力してください' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: false),
                decoration: const InputDecoration(
                  labelText: '金額',
                  suffixText: '円',
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final n = double.tryParse(v?.trim() ?? '');
                  if (n == null || n <= 0) return '正の金額を入力してください';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                // ignore: deprecated_member_use
                value: validCategoryId,
                decoration: const InputDecoration(
                  labelText: 'カテゴリ',
                  border: OutlineInputBorder(),
                ),
                hint: const Text('カテゴリを選択'),
                items: categories.map((c) {
                  return DropdownMenuItem<int>(
                    value: c.id,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 8,
                          backgroundColor: Color(c.colorValue),
                        ),
                        const SizedBox(width: 8),
                        Text(c.name),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (v) => setState(() => _selectedCategoryId = v),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('毎月'),
                  const SizedBox(width: 12),
                  DropdownButton<int>(
                    value: _selectedDay,
                    items: List.generate(31, (i) => i + 1)
                        .map((d) => DropdownMenuItem(value: d, child: Text('$d日')))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedDay = v!),
                  ),
                  const SizedBox(width: 8),
                  const Text('に自動登録'),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('キャンセル'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(_isEdit ? '更新' : '追加'),
        ),
      ],
    );
  }
}
