import 'package:freezed_annotation/freezed_annotation.dart';

part 'category.freezed.dart';

@freezed
class Category with _$Category {
  const factory Category({
    int? id, // Isarが採番するID。新規作成時はnull
    required String name, // カテゴリ名
    required int colorValue, // 色（Color.value で保存）
    required String iconName, // アイコン名（Material Iconsフィールド名。例: 'restaurant'）
    @Default(0) int sortOrder, // 一覧表示順
    required DateTime createdAt, // レコード作成日時
  }) = _Category;
}
