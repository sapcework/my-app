import 'package:flutter/material.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'json_file.dart';

enum SortMode {
  updatedDesc('更新が新しい順'), // 高速メモ帳と同じ（更新したメモが先頭に来る）
  createdDesc('作成が新しい順'),
  title('タイトル順');

  final String label;
  const SortMode(this.label);
}

const appColors = <(String, Color)>[ // 高速メモ帳の「アプリの色」と同じ6色
  ('赤', Color(0xFFEF5350)),
  ('橙', Color(0xFFFFA726)),
  ('緑', Color(0xFF66BB6A)),
  ('青', Color(0xFF6D7CF2)),
  ('紫', Color(0xFFCE5DE0)),
  ('灰', Color(0xFF78909C)),
];
const defaultAppColor = 3; // 青

// 表示まわりの設定（並び順・文字サイズ・テーマ）
class SettingsController extends ChangeNotifier {
  static const minFontSize = 12.0, maxFontSize = 28.0, defaultFontSize = 16.0;

  final JsonFile _store;
  SettingsController(this._store);

  SortMode _sort = SortMode.updatedDesc;
  double _fontSize = defaultFontSize;
  ThemeMode _themeMode = ThemeMode.system; // ナイトモードを一度も切り替えていなければ端末の設定に合わせる
  int _appColor = defaultAppColor;

  SortMode get sort => _sort;
  double get fontSize => _fontSize;
  ThemeMode get themeMode => _themeMode;
  int get appColorIndex => _appColor;
  Color get appColor => appColors[_appColor].$2;

  Future<void> load() async {
    final m = await _store.read();
    _sort = SortMode.values.asNameMap()[m['sort']] ?? SortMode.updatedDesc; // 旧版の「手動」は更新順にする
    final f = (m['fontSize'] as num?)?.toDouble() ?? defaultFontSize;
    _fontSize = f.clamp(minFontSize, maxFontSize);
    _themeMode = ThemeMode.values.asNameMap()[m['themeMode']] ?? ThemeMode.system;
    final c = (m['appColor'] as num?)?.toInt() ?? defaultAppColor;
    _appColor = c >= 0 && c < appColors.length ? c : defaultAppColor;
    notifyListeners();
  }

  Future<void> _save() => _store.write({'sort': _sort.name, 'fontSize': _fontSize, 'themeMode': _themeMode.name, 'appColor': _appColor});

  Future<void> setSort(SortMode v) async {
    _sort = v;
    notifyListeners();
    await _save();
  }

  Future<void> setFontSize(double v) async {
    _fontSize = v.clamp(minFontSize, maxFontSize).roundToDouble();
    notifyListeners();
    await _save();
  }

  Future<void> setNightMode(bool on) async {
    _themeMode = on ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
    await _save();
  }

  Future<void> setAppColor(int index) async {
    _appColor = index;
    notifyListeners();
    await _save();
  }
}

final settingsProvider = ChangeNotifierProvider<SettingsController>((ref) => throw UnimplementedError('main で override する'));
