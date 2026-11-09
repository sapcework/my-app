import 'package:fastnote/ui/widgets/selection_tools.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

// 文字を選ぶときの補助（選択の微調整バーと拡大鏡）のテスト

void main() {
  test('1文字の移動は絵文字を途中で切らず、端では止まる', () {
    const t = 'a😀b';
    expect(nextCharOffset(t, 0), 1);
    expect(nextCharOffset(t, 1), 3, reason: '絵文字は UTF-16 で2つ分');
    expect(prevCharOffset(t, 3), 1);
    expect(prevCharOffset(t, 0), 0);
    expect(nextCharOffset(t, t.length), t.length);
  });

  group('選択の微調整バー', () {
    late TextEditingController c;
    late FocusNode focus;

    Future<void> pump(WidgetTester tester, String text, {double width = 400}) async {
      c = TextEditingController(text: text);
      focus = FocusNode();
      addTearDown(c.dispose);
      addTearDown(focus.dispose);
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: width,
              child: Column(children: [
                Expanded(child: TextField(controller: c, focusNode: focus, readOnly: true, expands: true, maxLines: null, style: const TextStyle(fontSize: 16))),
                SelectionBar(controller: c, focusNode: focus),
              ]),
            ),
          ),
        ),
      ));
    }

    Future<void> select(WidgetTester tester, int start, int end) async {
      c.selection = TextSelection(baseOffset: start, extentOffset: end);
      await tester.pump();
    }

    Future<void> press(WidgetTester tester, String tooltip) async {
      await tester.tap(find.byTooltip(tooltip));
      await tester.pump();
    }

    bool enabled(WidgetTester tester, String tooltip) => tester.widget<IconButton>(find.ancestor(of: find.byTooltip(tooltip), matching: find.byType(IconButton)).first).onPressed != null;

    testWidgets('文字を選んでいる間だけ出る', (tester) async {
      await pump(tester, 'あいうえお');
      expect(find.text('始点'), findsNothing);
      await select(tester, 1, 3);
      expect(find.text('始点'), findsOneWidget);
      expect(find.text('終点'), findsOneWidget);
      await select(tester, 2, 2);
      expect(find.text('始点'), findsNothing, reason: 'カーソルだけのときは出さない');
    });

    testWidgets('始点と終点を1文字ずつ動かせる。始点と終点が入れ替わる方向には動かせない', (tester) async {
      await pump(tester, 'あいうえお');
      await select(tester, 2, 3);
      expect(enabled(tester, '始点を1文字後ろへ'), isFalse, reason: '1文字だけ選んでいるときは縮められない');
      expect(enabled(tester, '終点を1文字前へ'), isFalse);
      await press(tester, '始点を1文字前へ');
      expect(c.selection, const TextSelection(baseOffset: 1, extentOffset: 3));
      await press(tester, '終点を1文字後ろへ');
      await press(tester, '終点を1文字後ろへ');
      expect(c.selection, const TextSelection(baseOffset: 1, extentOffset: 5));
      expect(enabled(tester, '終点を1文字後ろへ'), isFalse, reason: '本文の最後');
      await press(tester, '始点を1文字後ろへ');
      await press(tester, '終点を1文字前へ');
      expect(c.selection, const TextSelection(baseOffset: 2, extentOffset: 4));
    });

    testWidgets('行の先頭・末尾まで広げられる（改行は含めない。もう一度押しても変わらない）', (tester) async {
      await pump(tester, 'あいうえお\nかきくけこ\nさしすせそ'); // か=6 … こ=10、改行=11
      await select(tester, 8, 9);
      await press(tester, '始点を行の先頭へ');
      await press(tester, '終点を行の末尾へ');
      expect(c.selection.textInside(c.text), 'かきくけこ');
      await press(tester, '始点を行の先頭へ');
      await press(tester, '終点を行の末尾へ');
      expect(c.selection.textInside(c.text), 'かきくけこ');
    });

    testWidgets('折り返した行では、画面上の行の端までにする', (tester) async {
      await pump(tester, 'あ' * 30, width: 200); // 1行に入りきらず折り返す
      await select(tester, 1, 2);
      await press(tester, '終点を行の末尾へ');
      final perLine = c.selection.end;
      expect(perLine, inInclusiveRange(5, 29), reason: '本文の最後ではなく、画面上の1行目の右端まで');
      await select(tester, perLine + 2, perLine + 3);
      await press(tester, '始点を行の先頭へ');
      expect(c.selection.start, perLine, reason: '2行目の左端');
      await press(tester, '終点を行の末尾へ');
      expect(c.selection.end, perLine * 2);
    });

    testWidgets('コピーを押すと選んだ文字だけがクリップボードに入り、選択は残る', (tester) async {
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
      await pump(tester, 'あいうえお');
      await select(tester, 1, 4);
      await press(tester, '選択した文字をコピー');
      expect(copied, 'いうえ');
      expect(c.selection, const TextSelection(baseOffset: 1, extentOffset: 4));
    });

    testWidgets('幅の狭い画面でもはみ出さない', (tester) async {
      await pump(tester, 'あいうえお', width: 280);
      await select(tester, 1, 3);
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(SelectionBar)).width, 280);
    });
  });

  group('拡大鏡', () {
    Future<Rect> show(WidgetTester tester, {required Offset finger, required Rect caret}) async {
      final info = ValueNotifier(MagnifierInfo(
        globalGesturePosition: finger,
        caretRect: caret,
        currentLineBoundaries: Rect.fromLTRB(4, caret.top, 796, caret.bottom),
        fieldBounds: const Rect.fromLTRB(0, 56, 800, 600),
      ));
      addTearDown(info.dispose);
      await tester.pumpWidget(MaterialApp(home: Stack(children: [NoteMagnifier(key: UniqueKey(), info: info)])));
      return tester.getRect(find.byType(RawMagnifier));
    }

    testWidgets('選んでいる行より十分上に、標準より大きく出る', (tester) async {
      final r = await show(tester, finger: const Offset(400, 310), caret: const Rect.fromLTWH(400, 300, 2, 20));
      expect(r.bottom, lessThanOrEqualTo(300 - NoteMagnifier.gap), reason: '指に隠れないよう行から離す');
      expect(r.center.dx, 400);
      expect(r.width, greaterThan(150));
      final m = tester.widget<RawMagnifier>(find.byType(RawMagnifier));
      expect(r.center + m.focalPointOffset, const Offset(400, 310), reason: '指のある行の、指の位置を映す');
    });

    testWidgets('画面の左右の端や上の端でも画面内に収まり、端の文字を映す', (tester) async {
      for (final x in [0.0, 800.0]) {
        final r = await show(tester, finger: Offset(x, 30), caret: Rect.fromLTWH(x.clamp(4, 796).toDouble(), 20, 2, 20));
        expect(r.left, greaterThanOrEqualTo(0));
        expect(r.right, lessThanOrEqualTo(800));
        expect(r.top, greaterThanOrEqualTo(0));
        final m = tester.widget<RawMagnifier>(find.byType(RawMagnifier));
        expect((r.center + m.focalPointOffset).dx, x.clamp(4, 796), reason: '内側へ寄せても、映すのは行の端');
        expect((r.center + m.focalPointOffset).dy, 30);
      }
    });
  });
}
