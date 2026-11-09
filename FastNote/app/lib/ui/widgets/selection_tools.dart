import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;

import '../note_actions.dart';

// メモの文字を選ぶときの補助（拡大鏡と、選択範囲を微調整するバー）。
// ハンドルを指で動かすだけでは行の端の文字に合わせにくく、標準の拡大鏡は指に隠れて見えないため

int prevCharOffset(String text, int offset) { // 1文字前の位置（絵文字などを途中で切らない）
  if (offset <= 0) return 0;
  final r = CharacterRange.at(text, math.min(offset, text.length));
  return r.moveBack() ? r.stringBeforeLength : 0;
}

int nextCharOffset(String text, int offset) { // 1文字後ろの位置
  if (offset >= text.length) return text.length;
  final r = CharacterRange.at(text, math.max(offset, 0));
  return r.moveNext() ? text.length - r.stringAfterLength : text.length;
}

// 標準より大きく、選んでいる行から離して出す拡大鏡
class NoteMagnifier extends StatelessWidget {
  static const size = Size(220, 64);
  static const gap = 40.0; // 行の上端から拡大鏡の下端までの距離（指に隠れない高さ）
  static const scale = 1.5;

  static final configuration = TextMagnifierConfiguration(magnifierBuilder: (context, controller, info) => NoteMagnifier(info: info));

  final ValueNotifier<MagnifierInfo> info;
  const NoteMagnifier({super.key, required this.info});

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final outline = Theme.of(context).colorScheme.onSurface;
    return ValueListenableBuilder<MagnifierInfo>(
      valueListenable: info,
      builder: (context, v, _) {
        final w = math.min(size.width, media.size.width);
        final line = v.currentLineBoundaries;
        final x = math.max(math.min(v.globalGesturePosition.dx, line.right), line.left); // 指の位置を追う（行の外には出ない）
        final want = Rect.fromLTWH(x - w / 2, v.caretRect.top - gap - size.height, w, size.height);
        final rect = MagnifierController.shiftWithinBounds(rect: want, bounds: Offset.zero & media.size); // 画面の端では内側へ寄せる（メモの最初の行でも指から離せるよう、上はステータスバーの所まで使う）
        return Positioned(
          left: rect.left,
          top: rect.top,
          child: RawMagnifier(
            size: rect.size,
            magnificationScale: scale,
            focalPointOffset: Offset(x, v.caretRect.center.dy) - rect.center, // 寄せた分だけ見る位置を戻し、端の文字も中央に映す
            clipBehavior: Clip.hardEdge,
            decoration: const MagnifierDecoration(shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(12)))),
            child: DecoratedBox( // 薄い影では電子ペーパーなどで見分けにくいので、はっきりした枠線にする
              decoration: BoxDecoration(border: Border.all(color: outline, width: 1.5), borderRadius: const BorderRadius.all(Radius.circular(12))),
            ),
          ),
        );
      },
    );
  }
}

// 文字を選んでいる間だけ画面の下に出すバー。始点・終点を1文字ずつ、または行の端まで動かせる
class SelectionBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode; // 入力欄のもの（画面上の行の区切りを調べるのに使う）
  const SelectionBar({super.key, required this.controller, required this.focusNode});

  EditableTextState? get _editable => focusNode.context?.findAncestorStateOfType<EditableTextState>();

  void _select(int start, int end, {required bool movedEnd}) {
    controller.selection = TextSelection(baseOffset: start, extentOffset: end);
    WidgetsBinding.instance.addPostFrameCallback((_) => _editable?.bringIntoView(TextPosition(offset: movedEnd ? end : start))); // 動かした側が画面の外なら見える所までスクロールする
  }

  int _lineStart(String text, int start) { // 画面上の行（折り返しを含む）の先頭
    final e = _editable;
    if (e != null) return math.min(start, e.renderEditable.getLineAtOffset(TextPosition(offset: start)).start);
    return start == 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  }

  int _lineEnd(String text, int end) { // 画面上の行の末尾（改行は含めない）
    final probe = text[end - 1] == '\n' ? end : end - 1; // 改行まで選んでいるときは次の行、そうでなければ最後に選んだ文字のある行
    final e = _editable;
    var le = e != null ? e.renderEditable.getLineAtOffset(TextPosition(offset: probe)).end : text.indexOf('\n', probe);
    if (le < 0) le = text.length;
    while (le > end && text[le - 1] == '\n') {
      le--;
    }
    return math.max(end, le);
  }

  Future<void> _copy(String selected) async {
    await Clipboard.setData(ClipboardData(text: selected));
    showMessage('選択した文字をコピーしました');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = Theme.of(context).textTheme.labelSmall;

    Widget button(IconData icon, String tip, VoidCallback? onPressed) => IconButton(
          icon: Icon(icon),
          tooltip: tip,
          onPressed: onPressed,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints.tightFor(width: 44, height: 44),
          style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap),
        );
    Widget group(String name, List<Widget> buttons) => Column(mainAxisSize: MainAxisSize.min, children: [
          Text(name, style: label),
          Row(mainAxisSize: MainAxisSize.min, children: buttons),
        ]);
    const divider = SizedBox(height: 44, child: VerticalDivider(width: 13));

    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final sel = value.selection;
        if (!sel.isValid || sel.isCollapsed) return const SizedBox.shrink();
        final text = value.text;
        final s = sel.start, e = sel.end;
        final ps = prevCharOffset(text, s), ns = nextCharOffset(text, s);
        final pe = prevCharOffset(text, e), ne = nextCharOffset(text, e);
        return TextFieldTapRegion( // バーを押しても入力欄の外を押した扱いにしない（選択を保つ）
          child: Material(
            color: scheme.surfaceContainerHigh,
            shape: Border(top: BorderSide(color: scheme.outline)),
            child: SizedBox(
              width: double.infinity,
              child: FittedBox( // 幅の狭い端末でもはみ出さないように縮める
                fit: BoxFit.scaleDown,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 4, 4, 2),
                  child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                    group('始点', [
                      button(Icons.first_page, '始点を行の先頭へ', () => _select(_lineStart(text, s), e, movedEnd: false)),
                      button(Icons.chevron_left, '始点を1文字前へ', ps < s ? () => _select(ps, e, movedEnd: false) : null),
                      button(Icons.chevron_right, '始点を1文字後ろへ', ns < e ? () => _select(ns, e, movedEnd: false) : null),
                    ]),
                    divider,
                    group('終点', [
                      button(Icons.chevron_left, '終点を1文字前へ', pe > s ? () => _select(s, pe, movedEnd: true) : null),
                      button(Icons.chevron_right, '終点を1文字後ろへ', ne > e ? () => _select(s, ne, movedEnd: true) : null),
                      button(Icons.last_page, '終点を行の末尾へ', () => _select(s, _lineEnd(text, e), movedEnd: true)),
                    ]),
                    divider,
                    group('コピー', [button(Icons.copy, '選択した文字をコピー', () => _copy(sel.textInside(text)))]),
                  ]),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
