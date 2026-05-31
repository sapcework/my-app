import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/constants/category_icons.dart';
import '../../../providers/category_providers.dart';

class AddCategoryDialog extends ConsumerStatefulWidget {
  const AddCategoryDialog({super.key});

  @override
  ConsumerState<AddCategoryDialog> createState() => _AddCategoryDialogState();
}

class _AddCategoryDialogState extends ConsumerState<AddCategoryDialog> {
  final _nameController = TextEditingController();
  int _selectedColor = kCategoryColors.first; // デフォルトはリスト先頭の色
  String _selectedIcon = kCategoryIconMap.keys.first; // デフォルトはリスト先頭のアイコン

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    await ref.read(addCategoryUseCaseProvider).call(
      name: name,
      colorValue: _selectedColor,
      iconName: _selectedIcon,
    );
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('カテゴリを追加'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'カテゴリ名'),
              autofocus: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            Text('カラー', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 8),
            _ColorGrid(
              selected: _selectedColor,
              onSelect: (color) => setState(() => _selectedColor = color),
            ),
            const SizedBox(height: 20),
            Text('アイコン', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 8),
            _IconGrid(
              selected: _selectedIcon,
              selectedColor: _selectedColor,
              onSelect: (icon) => setState(() => _selectedIcon = icon),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('キャンセル'),
        ),
        FilledButton(
          onPressed: _submit,
          child: const Text('追加'),
        ),
      ],
    );
  }
}

class _ColorGrid extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onSelect;

  const _ColorGrid({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: kCategoryColors.map((color) {
        final isSelected = color == selected;
        return GestureDetector(
          onTap: () => onSelect(color),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Color(color),
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(
                      color: Theme.of(context).colorScheme.onSurface,
                      width: 2.5,
                    )
                  : null,
            ),
            child: isSelected
                ? const Icon(Icons.check, color: Colors.white, size: 18)
                : null,
          ),
        );
      }).toList(),
    );
  }
}

class _IconGrid extends StatelessWidget {
  final String selected;
  final int selectedColor;
  final ValueChanged<String> onSelect;

  const _IconGrid({
    required this.selected,
    required this.selectedColor,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: kCategoryIconMap.entries.map((entry) {
        final isSelected = entry.key == selected;
        return GestureDetector(
          onTap: () => onSelect(entry.key),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isSelected ? Color(selectedColor) : Colors.grey.shade200,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              entry.value,
              color: isSelected ? Colors.white : Colors.grey.shade700,
              size: 22,
            ),
          ),
        );
      }).toList(),
    );
  }
}
