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

// 表示まわりの設定（並び順・文字サイズ・行間・文字間・テーマ）
class SettingsController extends ChangeNotifier {
  static const minFontSize = 12.0, maxFontSize = 32.0;
  static const defaultListFontSize = 18.0; // 一覧の見出し（タイトル）
  static const defaultDetailFontSize = 16.0; // 明細（メモを開いた画面）
  static const minLineHeight = 1.0, maxLineHeight = 2.0, defaultLineHeight = 1.3; // 明細の行間（文字の高さに対する倍率）
  static const minLetterSpacing = -1.0, maxLetterSpacing = 1.0, defaultLetterSpacing = -0.3; // 明細の文字間（論理ピクセル。マイナスで詰める）
  static const minPadding = 0.0, maxPadding = 16.0, defaultPadding = 4.0; // 明細の左右の余白（論理ピクセル）。広いと1行に入る文字が減る

  final JsonFile _store;
  SettingsController(this._store);

  SortMode _sort = SortMode.updatedDesc;
  double _listFontSize = defaultListFontSize;
  double _detailFontSize = defaultDetailFontSize;
  double _lineHeight = defaultLineHeight;
  double _letterSpacing = defaultLetterSpacing;
  double _detailPadding = defaultPadding;
  ThemeMode _themeMode = ThemeMode.system; // ナイトモードを一度も切り替えていなければ端末の設定に合わせる
  int _appColor = defaultAppColor;

  SortMode get sort => _sort;
  double get listFontSize => _listFontSize;
  double get detailFontSize => _detailFontSize;
  double get lineHeight => _lineHeight;
  double get letterSpacing => _letterSpacing;
  double get detailPadding => _detailPadding;
  ThemeMode get themeMode => _themeMode;
  int get appColorIndex => _appColor;
  Color get appColor => appColors[_appColor].$2;

  Future<void> load() async {
    final m = await _store.read();
    _sort = SortMode.values.asNameMap()[m['sort']] ?? SortMode.updatedDesc; // 旧版の「手動」は更新順にする
    double pick(String key, double def, double min, double max) => ((m[key] as num?)?.toDouble() ?? def).clamp(min, max);
    final old = (m['fontSize'] as num?)?.toDouble(); // 旧版は一覧と明細で共通の1つだけだった
    _detailFontSize = pick('detailFontSize', old ?? defaultDetailFontSize, minFontSize, maxFontSize);
    _listFontSize = pick('listFontSize', old != null ? old + 2 : defaultListFontSize, minFontSize, maxFontSize); // 見出しは明細より少し大きく
    _lineHeight = pick('lineHeight', defaultLineHeight, minLineHeight, maxLineHeight);
    _letterSpacing = pick('letterSpacing', defaultLetterSpacing, minLetterSpacing, maxLetterSpacing);
    _detailPadding = pick('detailPadding', defaultPadding, minPadding, maxPadding);
    _themeMode = ThemeMode.values.asNameMap()[m['themeMode']] ?? ThemeMode.system;
    final c = (m['appColor'] as num?)?.toInt() ?? defaultAppColor;
    _appColor = c >= 0 && c < appColors.length ? c : defaultAppColor;
    notifyListeners();
  }

  Future<void> _save() => _store.write({
        'sort': _sort.name,
        'listFontSize': _listFontSize,
        'detailFontSize': _detailFontSize,
        'lineHeight': _lineHeight,
        'letterSpacing': _letterSpacing,
        'detailPadding': _detailPadding,
        'themeMode': _themeMode.name,
        'appColor': _appColor,
      });

  Future<void> setSort(SortMode v) async {
    _sort = v;
    notifyListeners();
    await _save();
  }

  Future<void> setListFontSize(double v) async {
    _listFontSize = v.clamp(minFontSize, maxFontSize).roundToDouble();
    notifyListeners();
    await _save();
  }

  Future<void> setDetailFontSize(double v) async {
    _detailFontSize = v.clamp(minFontSize, maxFontSize).roundToDouble();
    notifyListeners();
    await _save();
  }

  Future<void> setLineHeight(double v) async {
    _lineHeight = (v.clamp(minLineHeight, maxLineHeight) * 20).round() / 20; // 0.05 刻み
    notifyListeners();
    await _save();
  }

  Future<void> setLetterSpacing(double v) async {
    _letterSpacing = (v.clamp(minLetterSpacing, maxLetterSpacing) * 10).round() / 10; // 0.1 刻み
    notifyListeners();
    await _save();
  }

  Future<void> setDetailPadding(double v) async {
    _detailPadding = v.clamp(minPadding, maxPadding).roundToDouble();
    notifyListeners();
    await _save();
  }

  Future<void> resetTextLayout() async { // 文字サイズ・行間・文字間・余白を初期値に戻す
    _listFontSize = defaultListFontSize;
    _detailFontSize = defaultDetailFontSize;
    _lineHeight = defaultLineHeight;
    _letterSpacing = defaultLetterSpacing;
    _detailPadding = defaultPadding;
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
