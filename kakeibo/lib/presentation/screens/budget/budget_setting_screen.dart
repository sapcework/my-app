import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/budget_providers.dart';

class BudgetSettingScreen extends ConsumerStatefulWidget {
  const BudgetSettingScreen({super.key});

  @override
  ConsumerState<BudgetSettingScreen> createState() => _BudgetSettingScreenState();
}

class _BudgetSettingScreenState extends ConsumerState<BudgetSettingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  bool _submitting = false;
  final DateTime _selectedMonth = () {
    final now = DateTime.now();
    return DateTime(now.year, now.month);
  }();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadBudget());
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadBudget() async {
    final budget = await ref
        .read(getBudgetUseCaseProvider)
        .call(_selectedMonth.year, _selectedMonth.month);
    if (budget != null && mounted) {
      _amountController.text = budget.amount.toInt().toString();
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final amount = double.parse(_amountController.text.trim());
      await ref.read(setBudgetUseCaseProvider).call(
            year: _selectedMonth.year,
            month: _selectedMonth.month,
            amount: amount,
          );
      ref.invalidate(currentMonthBudgetProvider);
      ref.invalidate(selectedMonthBudgetProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('予算を保存しました')),
        );
        context.pop();
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = DateFormat('yyyy年M月').format(_selectedMonth);

    return Scaffold(
      appBar: AppBar(title: const Text('月次予算の設定')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(monthLabel, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: false),
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: '予算金額',
                  suffixText: '円',
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final n = double.tryParse(v?.trim() ?? '');
                  if (n == null || n <= 0) return '正の金額を入力してください';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _save,
                child: const Text('保存'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
