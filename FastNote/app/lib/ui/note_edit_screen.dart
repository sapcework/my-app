import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart' show ShareParams, SharePlus;

import '../core/colors.dart';
import '../state/lock.dart';
import '../state/notes.dart';
import '../state/reminders.dart';
import '../state/settings.dart';
import 'note_actions.dart';
import 'widgets/color_sheet.dart';
import 'widgets/max_width.dart';

// メモの編集画面。入力は少し間を置いて自動保存し、画面を離れるときとアプリが裏に回るときにも保存する。
// 「読むモード」ではキーボードを出さずに表示する（長いメモを選んでコピーするときに、キーボードがメニューや本文をふさがないように）
class NoteEditScreen extends ConsumerStatefulWidget {
  final String? noteId; // null なら新規（何か書くまで保存しない）
  final String? folderId; // 新規メモを入れるフォルダ
  const NoteEditScreen({super.key, this.noteId, this.folderId});

  @override
  ConsumerState<NoteEditScreen> createState() => _NoteEditScreenState();
}

enum _Menu { star, reminder, copyAll, undo, redo, top, end, move, share, delete }

class _NoteEditScreenState extends ConsumerState<NoteEditScreen> with WidgetsBindingObserver {
  static const _debounce = Duration(milliseconds: 700);

  late final NotesController _notes; // 閉じた後の保存でも使うので、initState で必ず取っておく（遅延初期化だと閉じた後に ref を使ってしまう）
  late final TextEditingController _text;
  final _undo = UndoHistoryController();
  final _scroll = ScrollController();
  final _focus = FocusNode();
  String? _id;
  Timer? _timer;
  bool _dirty = false;
  bool _saved = false; // この画面で一度でも保存したか（閉じるときに「保存されました」を出す）
  bool _deleted = false;
  late bool _readOnly; // 読むモード（キーボードを出さない）
  Future<void> _saving = Future.value(); // 保存を直列にする（新規作成が二重にならないように）

  @override
  void initState() {
    super.initState();
    _notes = ref.read(notesProvider);
    _id = widget.noteId;
    _readOnly = widget.noteId != null && ref.read(settingsProvider).openInReadMode; // 新しいメモはすぐ書けるよう常に書くモード
    _text = TextEditingController(text: _id == null ? '' : _notes.byId(_id!)?.body ?? '');
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _leave();
    _text.dispose();
    _undo.dispose();
    _scroll.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) _flush(); // 裏に回ったまま終了されても失わないように
  }

  void _onChanged(String _) {
    _dirty = true;
    _timer?.cancel();
    _timer = Timer(_debounce, _flush);
  }

  void _flush() {
    _timer?.cancel();
    if (!_dirty || _deleted) return;
    _dirty = false;
    final body = _text.text;
    _saving = _saving.then((_) async {
      if (_id == null) {
        if (body.trim().isEmpty) return;
        final n = await _notes.create(body, folderId: widget.folderId);
        _id = n.id;
        _saved = true;
        if (mounted) setState(() {});
      } else if (_notes.byId(_id!) != null && _notes.byId(_id!)!.body != body) {
        await _notes.updateBody(_id!, body);
        _saved = true;
      }
    });
  }

  void _leave() { // 画面を閉じるとき。空にしたメモはごみ箱に入れず消す（中身が無いので）
    _flush();
    final body = _text.text;
    final saved = _saved;
    _saving = _saving.then((_) async {
      if (_deleted || _id == null || _notes.byId(_id!) == null) return;
      if (body.trim().isEmpty) {
        await _notes.deletePermanently(_id!);
      } else if (saved || _saved) {
        showMessage('保存されました');
      }
    });
  }

  Future<String?> _ensureSaved() async { // 色・☆などはメモが保存されていないと付けられない
    _flush();
    await _saving;
    if (_id == null) showMessage('先に本文を入力してください');
    return _id;
  }

  Future<void> _colors() async {
    final id = await _ensureSaved();
    if (id == null || !mounted) return;
    final n = _notes.byId(id)!;
    await showColorSheet(context, bg: n.bgColor, fg: n.textColor, onChanged: (bg, fg) => _notes.updateColors(id, bg: bg, fg: fg));
  }

  void _scrollTo({required bool end}) { // 先頭・末尾へスクロールする。書くモードではカーソルも動かす（読むモードではキーボードを出さない）
    if (!_readOnly) {
      _focus.requestFocus();
      _text.selection = TextSelection.collapsed(offset: end ? _text.text.length : 0);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(end ? _scroll.position.maxScrollExtent : 0);
    });
  }

  void _setReadOnly(bool v) {
    if (v) _flush(); // 読むモードに入る前に保存しておく
    _focus.unfocus(); // キーボードを閉じる（書くモードに戻すときは、付け直してキーボードを出す）
    setState(() => _readOnly = v);
    if (!v) WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  Future<void> _copyAll() async {
    if (_text.text.isEmpty) return showMessage('コピーする本文がありません');
    await Clipboard.setData(ClipboardData(text: _text.text));
    showMessage('全文をコピーしました');
  }

  Future<void> _onMenu(_Menu m) async {
    switch (m) {
      case _Menu.undo:
        _undo.undo();
      case _Menu.redo:
        _undo.redo();
      case _Menu.top:
        _scrollTo(end: false);
      case _Menu.end:
        _scrollTo(end: true);
      case _Menu.copyAll:
        await _copyAll();
      case _Menu.share:
        final text = _text.text;
        if (text.trim().isEmpty) return showMessage('共有する本文がありません');
        final lock = ref.read(lockProvider);
        await lock.suspendRelock(() => SharePlus.instance.share(ShareParams(text: text))); // 共有シートから戻ったときに再ロックしない
      case _Menu.delete:
        _flush();
        await _saving;
        final note = _id == null ? null : _notes.byId(_id!);
        _deleted = true;
        if (mounted) Navigator.pop(context);
        if (note != null) await trashWithUndo(_notes, note);
      case _Menu.star:
        final id = await _ensureSaved();
        if (id == null) return;
        final on = !_notes.byId(id)!.starred;
        await _notes.setStarred(id, on);
        showMessage(on ? '☆を付けました（一覧の先頭に固定されます）' : '☆を外しました');
      case _Menu.reminder:
        final id = await _ensureSaved();
        if (id == null || !mounted) return;
        await editReminder(context, _notes, ref.read(remindersProvider), _notes.byId(id)!);
      case _Menu.move:
        final id = await _ensureSaved();
        if (id == null || !mounted) return;
        await moveToFolderDialog(context, _notes, _notes.byId(id)!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final notes = ref.watch(notesProvider);
    final note = _id == null ? null : notes.byId(_id!);
    final scheme = Theme.of(context).colorScheme;
    final c = noteColors(note?.bgColor, note?.textColor, surface: scheme.surface, onSurface: scheme.onSurface);
    final upcoming = note?.reminderAt != null && note!.reminderAt! > DateTime.now().millisecondsSinceEpoch;

    PopupMenuItem<_Menu> item(_Menu v, IconData icon, String label, {bool enabled = true}) => PopupMenuItem(
          value: v,
          enabled: enabled,
          child: Row(children: [Icon(icon, size: 20), const SizedBox(width: 12), Text(label)]),
        );

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        title: Text(notes.scopeName(NoteScope.folder(note?.folderId ?? widget.folderId)), maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (note?.starred ?? false) const Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Icon(Icons.star, semanticLabel: '☆付き')),
          _readOnly
              ? IconButton(tooltip: '書く', icon: const Icon(Icons.edit_outlined), onPressed: () => _setReadOnly(false))
              : IconButton(tooltip: '読むモード（キーボードを出さない）', icon: const Icon(Icons.chrome_reader_mode_outlined), onPressed: () => _setReadOnly(true)),
          IconButton(tooltip: '色', icon: const Icon(Icons.contrast), onPressed: _colors),
          ValueListenableBuilder<UndoHistoryValue>(
            valueListenable: _undo,
            builder: (context, undo, _) => PopupMenuButton<_Menu>(
              tooltip: 'メニュー',
              onSelected: _onMenu,
              itemBuilder: (_) => [
                item(_Menu.star, note?.starred ?? false ? Icons.star : Icons.star_border, note?.starred ?? false ? '☆を外す' : '☆を付ける'),
                item(_Menu.reminder, upcoming ? Icons.alarm_on : Icons.alarm, upcoming ? 'リマインダー（${formatReminder(note.reminderAt!)}）' : 'リマインダー'),
                item(_Menu.copyAll, Icons.copy_all_outlined, '全文をコピー'),
                item(_Menu.undo, Icons.undo, '編集を元に戻す', enabled: undo.canUndo && !_readOnly),
                item(_Menu.redo, Icons.redo, 'やり直す', enabled: undo.canRedo && !_readOnly),
                item(_Menu.top, Icons.vertical_align_top, '最初へ'),
                item(_Menu.end, Icons.vertical_align_bottom, '最後へ'),
                item(_Menu.move, Icons.drive_file_move_outlined, 'フォルダへ移動'),
                item(_Menu.share, Icons.share_outlined, '共有'),
                item(_Menu.delete, Icons.delete_outline, '削除'),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: MaxWidth(child: TextField( // タブレットでは読みやすい幅に収める
          controller: _text,
          undoController: _undo,
          scrollController: _scroll,
          focusNode: _focus,
          onChanged: _onChanged,
          autofocus: widget.noteId == null,
          readOnly: _readOnly, // 読むモードではキーボードを出さない（長押しでの選択とコピーはできる）
          showCursor: !_readOnly,
          expands: true,
          maxLines: null,
          keyboardType: TextInputType.multiline,
          textAlignVertical: TextAlignVertical.top,
          cursorColor: c.fg,
          style: TextStyle(fontSize: settings.detailFontSize, height: settings.lineHeight, letterSpacing: settings.letterSpacing, color: c.fg),
          decoration: InputDecoration(
            border: InputBorder.none,
            contentPadding: EdgeInsets.fromLTRB(settings.detailPadding, 8, settings.detailPadding, 24), // 左右の余白は設定で変えられる
            hintText: '1行目がタイトルになります',
          ),
        )),
      ),
    );
  }
}
