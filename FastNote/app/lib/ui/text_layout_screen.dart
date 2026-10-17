import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/settings.dart';

// 文字の大きさ・行間・文字の間隔の調整画面。
// 設定画面に直接スライダーを置くと、スクロール中にうっかり触れて値が変わるため、別の画面にしている
class TextLayoutScreen extends ConsumerWidget {
  const TextLayoutScreen({super.key});

  static String summary(SettingsController s) => // 設定画面の1行に出す現在値
      '一覧 ${s.listFontSize.round()}・明細 ${s.detailFontSize.round()}・行間 ${s.lineHeight.toStringAsFixed(2)}・間隔 ${_spacing(s.letterSpacing)}・余白 ${s.detailPadding.round()}';

  static String _spacing(double v) => v == 0 ? '0' : v.toStringAsFixed(1);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(settingsProvider);
    final theme = Theme.of(context);
    Widget header(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
          child: Text(t, style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        );
    Widget slider(String label, double value, double min, double max, double step, String Function(double) format, ValueChanged<double> onChanged) => ListTile(
          title: Text(label),
          trailing: Text(format(value)),
          subtitle: Slider(min: min, max: max, divisions: ((max - min) / step).round(), value: value, label: format(value), onChanged: onChanged),
        );
    Widget preview(Widget child, double horizontal) => Container( // 実際の画面と同じ左右の余白で見本を出す
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: 8),
          decoration: BoxDecoration(border: Border.all(color: theme.colorScheme.outlineVariant), borderRadius: BorderRadius.circular(4)),
          child: child,
        );
    String size(double v) => '${v.round()}';

    return Scaffold(
      appBar: AppBar(title: const Text('文字の大きさ・行間')),
      body: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
        header('一覧'),
        slider('見出しの文字サイズ', s.listFontSize, SettingsController.minFontSize, SettingsController.maxFontSize, 1, size, s.setListFontSize),
        preview(Text('買い物リスト', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: s.listFontSize)), 10),

        header('明細（メモを開いた画面）'),
        slider('文字サイズ', s.detailFontSize, SettingsController.minFontSize, SettingsController.maxFontSize, 1, size, s.setDetailFontSize),
        slider('行間', s.lineHeight, SettingsController.minLineHeight, SettingsController.maxLineHeight, 0.05, (v) => v.toStringAsFixed(2), s.setLineHeight),
        slider('文字の間隔', s.letterSpacing, SettingsController.minLetterSpacing, SettingsController.maxLetterSpacing, 0.1, _spacing, s.setLetterSpacing),
        slider('左右の余白', s.detailPadding, SettingsController.minPadding, SettingsController.maxPadding, 1, size, s.setDetailPadding),
        preview(
          Text(
            '明日の予定\n10時 打ち合わせ（資料を印刷する）\n帰りに牛乳とパンを買う。Amazon の注文も確認する',
            style: TextStyle(fontSize: s.detailFontSize, height: s.lineHeight, letterSpacing: s.letterSpacing),
          ),
          s.detailPadding,
        ),
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton(onPressed: s.resetTextLayout, child: const Text('初期値に戻す')),
          ),
        ),
      ]),
    );
  }
}
