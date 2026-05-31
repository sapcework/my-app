import 'package:flutter/material.dart';

// カテゴリ選択で使用する定義済みカラー（ARGB int）
const kCategoryColors = [
  0xFFFF9800, // Orange
  0xFF2196F3, // Blue
  0xFF4CAF50, // Green
  0xFF9C27B0, // Purple
  0xFFF44336, // Red
  0xFF009688, // Teal
  0xFFE91E63, // Pink
  0xFF3F51B5, // Indigo
  0xFFFF5722, // Deep Orange
  0xFF795548, // Brown
  0xFF607D8B, // Blue Grey
  0xFF9E9E9E, // Grey
];

// カテゴリ選択で使用する定義済みアイコン（iconName → IconData）
const kCategoryIconMap = <String, IconData>{
  'restaurant': Icons.restaurant,
  'directions_car': Icons.directions_car,
  'shopping_cart': Icons.shopping_cart,
  'sports_esports': Icons.sports_esports,
  'local_hospital': Icons.local_hospital,
  'home': Icons.home_outlined,
  'work': Icons.work_outline,
  'school': Icons.school_outlined,
  'local_cafe': Icons.local_cafe,
  'flight': Icons.flight,
  'fitness_center': Icons.fitness_center,
  'more_horiz': Icons.more_horiz,
};
