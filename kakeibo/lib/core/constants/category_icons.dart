import 'package:flutter/material.dart';

// カテゴリ選択で使用する定義済みカラー（ARGB int）
const kCategoryColors = [
  0xFFFF9800, // Orange
  0xFFFF5722, // Deep Orange
  0xFF2196F3, // Blue
  0xFF03A9F4, // Light Blue
  0xFF4CAF50, // Green
  0xFF8BC34A, // Light Green
  0xFF9C27B0, // Purple
  0xFFF44336, // Red
  0xFFE91E63, // Pink
  0xFF009688, // Teal
  0xFF00BCD4, // Cyan
  0xFFFFC107, // Amber
  0xFF3F51B5, // Indigo
  0xFF795548, // Brown
  0xFF607D8B, // Blue Grey
  0xFF9E9E9E, // Grey
];

// カテゴリ選択で使用する定義済みアイコン（iconName → IconData）
const kCategoryIconMap = <String, IconData>{
  'restaurant': Icons.restaurant,
  'ramen_dining': Icons.ramen_dining,
  'home': Icons.home_outlined,
  'lightbulb': Icons.lightbulb_outline,
  'smartphone': Icons.smartphone,
  'directions_car': Icons.directions_car,
  'shopping_cart': Icons.shopping_cart,
  'checkroom': Icons.checkroom,
  'local_hospital': Icons.local_hospital,
  'shield': Icons.shield_outlined,
  'menu_book': Icons.menu_book,
  'credit_card': Icons.credit_card,
  'sports_esports': Icons.sports_esports,
  'flight': Icons.flight,
  'savings': Icons.savings_outlined,
  'inventory_2': Icons.inventory_2_outlined,
  'work': Icons.work_outline,
  'school': Icons.school_outlined,
  'local_cafe': Icons.local_cafe,
  'fitness_center': Icons.fitness_center,
  'more_horiz': Icons.more_horiz,
};
