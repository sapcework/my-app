import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'json_file.dart';

enum SortMode {
  manual('手動（ドラッグで並べ替え）'),
  updatedDesc('更新が新しい順'),
  updatedAsc('更新が古い順'),
  title('タイトル順');

  final String label;
  const SortMode(this.label);
}

// 表示まわりの設定（並び順・文字サイズ）
class SettingsController extends ChangeNotifier {
  static const minFontSize = 12.0, maxFontSize = 28.0, defaultFontSize = 16.0;

  final JsonFile _store;
  SettingsController(this._store);

  SortMode _sort = SortMode.manual; // 取り込んだときの高速メモ帳の並びをそのまま見せる
  double _fontSize = defaultFontSize;

  SortMode get sort => _sort;
  double get fontSize => _fontSize;

  Future<void> load() async {
    final m = await _store.read();
    _sort = SortMode.values.asNameMap()[m['sort']] ?? SortMode.manual;
    final f = (m['fontSize'] as num?)?.toDouble() ?? defaultFontSize;
    _fontSize = f.clamp(minFontSize, maxFontSize);
    notifyListeners();
  }

  Future<void> _save() => _store.write({'sort': _sort.name, 'fontSize': _fontSize});

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
}

final settingsProvider = ChangeNotifierProvider<SettingsController>((ref) => throw UnimplementedError('main で override する'));
