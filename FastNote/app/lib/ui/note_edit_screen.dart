import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/colors.dart';
import '../state/notes.dart';
import '../state/settings.dart';
import 'note_actions.dart';
import 'widgets/color_sheet.dart';

// メモの編集画面。入力は少し間を置いて自動保存し、画面を離れるときとアプリが裏に回るときにも保存する
class NoteEditScreen extends ConsumerStatefulWidget {
  final String? noteId; // null なら新規（何か書くまで保存しない）
  const NoteEditScreen({super.key, this.noteId});

  @override
  ConsumerState<NoteEditScreen> createState() => _NoteEditScreenState();
}

class _NoteEditScreenState extends ConsumerState<NoteEditScreen> with WidgetsBindingObserver {
  static const _debounce = Duration(milliseconds: 700);

  late final NotesController _notes = ref.read(notesProvider); // dispose 中でも使えるように最初に取っておく
  late final TextEditingController _text;
  String? _id;
  Timer? _timer;
  bool _dirty = false;
  bool _deleted = false;
  Future<void> _saving = Future.value(); // 保存を直列にする（新規作成が二重にならないように）

  @override
  void initState() {
    super.initState();
    _id = widget.noteId;
    _text = TextEditingController(text: _id == null ? '' : _notes.byId(_id!)?.body ?? '');
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _leave();
    _text.dispose();
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
        final n = await _notes.create(body);
        _id = n.id;
        if (mounted) setState(() {});
      } else if (_notes.byId(_id!) != null && _notes.byId(_id!)!.body != body) {
        await _notes.updateBody(_id!, body);
        if (mounted) setState(() {});
      }
    });
  }

  void _leave() { // 画面を閉じるとき。空にしたメモは消す
    _flush();
    final body = _text.text;
    _saving = _saving.then((_) async {
      if (!_deleted && _id != null && body.trim().isEmpty && _notes.byId(_id!) != null) await _notes.delete(_id!);
    });
  }

  Future<void> _delete() async {
    _flush();
    await _saving;
    final note = _id == null ? null : _notes.byId(_id!);
    _deleted = true;
    if (mounted) Navigator.pop(context);
    if (note != null) await deleteWithUndo(_notes, note);
  }

  Future<void> _colors() async {
    _flush();
    await _saving;
    if (!mounted) return;
    if (_id == null) {
      showMessage('先に本文を入力してください');
      return;
    }
    final n = _notes.byId(_id!)!;
    await showColorSheet(context, bg: n.bgColor, fg: n.textColor, onChanged: (bg, fg) => _notes.updateColors(n.id, bg: bg, fg: fg));
  }

  @override
  Widget build(BuildContext context) {
    final fontSize = ref.watch(settingsProvider).fontSize;
    final note = _id == null ? null : ref.watch(notesProvider).byId(_id!);
    final c = noteColors(note?.bgColor, note?.textColor);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bg,
        foregroundColor: c.bg != null ? Colors.black87 : null,
        title: Text(
          note == null ? '新しいメモ' : '更新 ${DateFormat('yyyy/MM/dd HH:mm').format(DateTime.fromMillisecondsSinceEpoch(note.updatedAt))}',
          style: theme.textTheme.bodyMedium?.copyWith(color: c.bg != null ? Colors.black54 : null),
        ),
        actions: [
          IconButton(tooltip: '色', icon: const Icon(Icons.palette_outlined), onPressed: _colors),
          IconButton(tooltip: '削除', icon: const Icon(Icons.delete_outline), onPressed: _delete),
        ],
      ),
      body: SafeArea(
        child: TextField(
          controller: _text,
          onChanged: _onChanged,
          autofocus: widget.noteId == null,
          expands: true,
          maxLines: null,
          keyboardType: TextInputType.multiline,
          textAlignVertical: TextAlignVertical.top,
          cursorColor: c.fg,
          style: TextStyle(fontSize: fontSize, height: 1.5, color: c.fg),
          decoration: const InputDecoration(
            border: InputBorder.none,
            contentPadding: EdgeInsets.fromLTRB(16, 8, 16, 24),
            hintText: '1行目がタイトルになります',
          ),
        ),
      ),
    );
  }
}
