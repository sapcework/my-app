import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/colors.dart';
import '../data/note.dart';
import '../state/notes.dart';
import '../state/settings.dart';
import 'note_actions.dart';
import 'note_edit_screen.dart';
import 'settings_screen.dart';
import 'widgets/color_sheet.dart';
import 'widgets/max_width.dart';
import 'widgets/theme_dialog.dart';

// メモ一覧（高速メモ帳と同じく、左の ≡ でフォルダ・ごみ箱・色・設定のメニューを開く）。
// メモを長押しすると選択モードになり、まとめて☆・色・移動・削除ができる
class NoteListScreen extends ConsumerStatefulWidget {
  const NoteListScreen({super.key});

  @override
  ConsumerState<NoteListScreen> createState() => _NoteListScreenState();
}

class _NoteListScreenState extends ConsumerState<NoteListScreen> {
  final _query = TextEditingController();
  bool _searching = false;
  NoteScope _scope = NoteScope.home;
  final Set<String> _selected = {}; // 選択中のメモの ID（空なら選択モードではない）

  bool get _selecting => _selected.isNotEmpty;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _open(String? id) => Navigator.push(context, MaterialPageRoute(builder: (_) => NoteEditScreen(noteId: id, folderId: _scope.folderId)));

  void _closeSearch() => setState(() {
        _searching = false;
        _query.clear();
      });

  void _selectScope(NoteScope s) {
    Navigator.pop(context); // メニューを閉じる
    setState(() {
      _scope = s;
      _selected.clear();
    });
  }

  void _toggle(String id) => setState(() => _selected.contains(id) ? _selected.remove(id) : _selected.add(id));

  void _clearSelection() => setState(_selected.clear);

  // ---- ごみ箱のメモ（タップで1件ずつ戻す・消す） ----

  Future<void> _trashNoteMenu(Note note) async {
    final notes = ref.read(notesProvider);
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.restore), title: const Text('元に戻す'), onTap: () => Navigator.pop(context, 'restore')),
          ListTile(leading: const Icon(Icons.delete_forever_outlined), title: const Text('完全に削除'), onTap: () => Navigator.pop(context, 'purge')),
        ]),
      ),
    );
    if (!mounted) return;
    if (action == 'restore') {
      await notes.restoreFromTrash(note.id);
      showMessage('「${noteLabel(note)}」を元に戻しました');
    }
    if (action == 'purge' && await _confirm('完全に削除', '「${noteLabel(note)}」を完全に削除します。元に戻せません。')) await notes.deletePermanently(note.id);
  }

  // ---- 選択モードの操作 ----

  List<Note> _selectedNotes(NotesController notes) => [for (final id in _selected) ?notes.byId(id)];

  Future<void> _bulkStar(NotesController notes) async {
    final targets = _selectedNotes(notes);
    final on = !targets.every((n) => n.starred); // 全部☆付きなら外す、そうでなければ付ける
    await notes.setStarredMany(_selected, on);
    showMessage(on ? '${targets.length} 件に☆を付けました（一覧の先頭に固定されます）' : '${targets.length} 件の☆を外しました');
    _clearSelection();
  }

  Future<void> _bulkColor(NotesController notes) async {
    final ids = {..._selected};
    final first = _selectedNotes(notes).firstOrNull;
    await showColorSheet(context, bg: first?.bgColor, fg: first?.textColor, onChanged: (bg, fg) => notes.updateColorsMany(ids, bg: bg, fg: fg));
    if (mounted) _clearSelection();
  }

  Future<void> _bulkMove(NotesController notes) async {
    await moveNotesToFolderDialog(context, notes, _selectedNotes(notes));
    if (mounted) _clearSelection();
  }

  Future<void> _bulkTrash(NotesController notes) async {
    await trashManyWithUndo(notes, {..._selected});
    _clearSelection();
  }

  Future<void> _bulkRestore(NotesController notes) async {
    final restored = await notes.restoreManyFromTrash({..._selected});
    showMessage('${restored.length} 件を元に戻しました');
    _clearSelection();
  }

  Future<void> _bulkPurge(NotesController notes) async {
    final n = _selected.length;
    if (!await _confirm('完全に削除', '選んだ $n 件のメモを完全に削除します。元に戻せません。')) return;
    await notes.deleteManyPermanently({..._selected});
    showMessage('$n 件を完全に削除しました');
    _clearSelection();
  }

  Future<bool> _confirm(String title, String body) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('キャンセル')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('削除')),
          ],
        ),
      ) ??
      false;

  Future<void> _emptyTrash() async {
    final notes = ref.read(notesProvider);
    final n = notes.count(const NoteScope.trash());
    if (n == 0) return;
    if (!await _confirm('ごみ箱を空にする', 'ごみ箱の $n 件のメモを完全に削除します。元に戻せません。')) return;
    await notes.emptyTrash();
    showMessage('ごみ箱を空にしました');
  }

  // ---- 横メニュー ----

  Future<void> _folderMenu(Folder f) async { // 横メニューのフォルダを長押ししたとき
    final notes = ref.read(notesProvider);
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('名前を変える'), onTap: () => Navigator.pop(context, 'rename')),
          ListTile(leading: const Icon(Icons.folder_delete_outlined), title: const Text('フォルダを削除'), onTap: () => Navigator.pop(context, 'delete')),
        ]),
      ),
    );
    if (!mounted) return;
    if (action == 'rename') {
      final name = await askFolderName(context, title: '名前を変える', initial: f.name);
      if (name != null) await notes.renameFolder(f.id, name);
    }
    if (action == 'delete' && await _confirm('フォルダを削除', '「${f.name}」を削除します。中のメモは「$defaultFolderName」に移ります。')) {
      await notes.deleteFolder(f.id);
      if (_scope.folderId == f.id) setState(() => _scope = NoteScope.home);
    }
  }

  Future<void> _newFolder() async {
    Navigator.pop(context);
    final name = await askFolderName(context);
    if (name == null) return;
    final f = await ref.read(notesProvider).createFolder(name);
    setState(() => _scope = NoteScope.folder(f.id));
  }

  Widget _drawer(NotesController notes) {
    final theme = Theme.of(context);
    Widget scopeTile(IconData icon, String label, NoteScope s, {VoidCallback? onLongPress}) => ListTile(
          leading: Icon(icon),
          title: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: Text('${notes.count(s)}'),
          selected: _scope == s,
          selectedTileColor: theme.colorScheme.primary.withValues(alpha: 0.12),
          onTap: () => _selectScope(s),
          onLongPress: onLongPress,
        );
    return Drawer(
      child: ListView(padding: EdgeInsets.zero, children: [
        Container(
          color: theme.appBarTheme.backgroundColor,
          padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 20, 16, 20),
          child: Text('FastNote', style: theme.textTheme.titleLarge?.copyWith(color: theme.appBarTheme.foregroundColor)),
        ),
        scopeTile(Icons.folder, defaultFolderName, NoteScope.home),
        for (final f in notes.folders) scopeTile(Icons.folder_outlined, f.name, NoteScope.folder(f.id), onLongPress: () => _folderMenu(f)),
        scopeTile(Icons.delete_outline, 'ごみ箱', const NoteScope.trash()),
        const Divider(),
        ListTile(leading: const Icon(Icons.create_new_folder_outlined), title: const Text('新しいフォルダ'), onTap: _newFolder),
        ListTile(
          leading: const Icon(Icons.contrast),
          title: const Text('色'),
          onTap: () {
            Navigator.pop(context);
            showThemeDialog(context);
          },
        ),
        ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('設定'),
          onTap: () {
            Navigator.pop(context);
            Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
          },
        ),
        if (notes.folders.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('フォルダを長押しすると、名前の変更や削除ができます', style: theme.textTheme.bodySmall),
          ),
      ]),
    );
  }

  // ---- 上のバー ----

  AppBar _selectionBar(NotesController notes, List<Note> visible) {
    final allStarred = _selectedNotes(notes).every((n) => n.starred);
    return AppBar(
      leading: IconButton(tooltip: '選択を解除', icon: const Icon(Icons.close), onPressed: _clearSelection),
      title: Text('${_selected.length} 件を選択'),
      actions: [
        IconButton(
          tooltip: 'すべて選択',
          icon: const Icon(Icons.select_all),
          onPressed: () => setState(() => _selected.addAll(visible.map((n) => n.id))),
        ),
        if (_scope.trash) ...[
          IconButton(tooltip: '元に戻す', icon: const Icon(Icons.restore), onPressed: () => _bulkRestore(notes)),
          IconButton(tooltip: '完全に削除', icon: const Icon(Icons.delete_forever_outlined), onPressed: () => _bulkPurge(notes)),
        ] else ...[
          IconButton(tooltip: allStarred ? '☆を外す' : '☆を付ける', icon: Icon(allStarred ? Icons.star : Icons.star_border), onPressed: () => _bulkStar(notes)),
          IconButton(tooltip: '色', icon: const Icon(Icons.palette_outlined), onPressed: () => _bulkColor(notes)),
          IconButton(tooltip: 'フォルダへ移動', icon: const Icon(Icons.drive_file_move_outlined), onPressed: () => _bulkMove(notes)),
          IconButton(tooltip: '削除', icon: const Icon(Icons.delete_outline), onPressed: () => _bulkTrash(notes)),
        ],
      ],
    );
  }

  AppBar _normalBar(NotesController notes) {
    final barFg = Theme.of(context).appBarTheme.foregroundColor;
    return AppBar(
      title: _searching
          ? TextField(
              controller: _query,
              autofocus: true,
              style: TextStyle(color: barFg),
              cursorColor: barFg,
              decoration: InputDecoration(hintText: '検索', hintStyle: TextStyle(color: barFg?.withValues(alpha: 0.7)), border: InputBorder.none),
              onChanged: (_) => setState(() {}),
            )
          : Text(notes.scopeName(_scope)),
      actions: [
        IconButton(
          tooltip: _searching ? '検索を閉じる' : '検索',
          icon: Icon(_searching ? Icons.close : Icons.search),
          onPressed: () => _searching ? _closeSearch() : setState(() => _searching = true),
        ),
        if (_scope.trash) IconButton(tooltip: 'ごみ箱を空にする', icon: const Icon(Icons.delete_sweep_outlined), onPressed: _emptyTrash),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notesProvider);
    final settings = ref.watch(settingsProvider);
    if (!_scope.trash && _scope.folderId != null && notes.folderById(_scope.folderId) == null) _scope = NoteScope.home; // フォルダが消えていたら戻る
    final list = notes.view(_scope, settings.sort, _query.text);
    _selected.removeWhere((id) => !list.any((n) => n.id == id)); // 消えたり絞り込みで見えなくなったメモは選択から外す

    return PopScope(
      canPop: !_searching && !_selecting, // 戻るボタンは、まず選択を解除し、次に検索を閉じる
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _selecting ? _clearSelection() : _closeSearch();
      },
      child: Scaffold(
        drawer: _selecting ? null : _drawer(notes),
        appBar: _selecting ? _selectionBar(notes, list) : _normalBar(notes),
        body: list.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(
                    _query.text.trim().isNotEmpty
                        ? '「${_query.text}」を含むメモはありません'
                        : _scope.trash
                            ? 'ごみ箱は空です'
                            : notes.notes.isEmpty
                                ? 'メモはまだありません。\n右下の＋で作成するか、設定から高速メモ帳のバックアップを取り込めます。'
                                : 'このフォルダにメモはありません',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : MaxWidth(
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 88), // FAB に最後の行が隠れないように
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final n = list[i];
                    return NoteTile(
                      key: ValueKey(n.id),
                      note: n,
                      fontSize: settings.listFontSize,
                      query: _query.text.trim(),
                      selected: _selected.contains(n.id),
                      onTap: () => _selecting
                          ? _toggle(n.id)
                          : n.inTrash
                              ? _trashNoteMenu(n) // ごみ箱のメモは開かずに戻す・消すを選ぶ
                              : _open(n.id),
                      onLongPress: () => _toggle(n.id), // 長押しで選択モードに入る
                    );
                  },
                ),
              ),
        floatingActionButton: _scope.trash || _selecting
            ? null
            : FloatingActionButton(tooltip: '新しいメモ', onPressed: () => _open(null), child: const Icon(Icons.add)),
      ),
    );
  }
}

class NoteTile extends StatelessWidget {
  final Note note;
  final double fontSize;
  final String query; // 検索中なら、一致した箇所を太字にする
  final bool selected;
  final VoidCallback onTap, onLongPress;

  const NoteTile({
    super.key,
    required this.note,
    required this.fontSize,
    required this.onTap,
    required this.onLongPress,
    this.query = '',
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final c = noteColors(note.bgColor, note.textColor, surface: scheme.surface, onSurface: scheme.onSurface);
    final sub = c.bg != null || note.textColor != null ? c.fg.withValues(alpha: 0.7) : scheme.onSurfaceVariant; // 色付きのメモは文字色に合わせて薄く
    final small = theme.textTheme.bodySmall?.copyWith(color: sub);
    final upcoming = note.reminderAt != null && !note.inTrash && note.reminderAt! > DateTime.now().millisecondsSinceEpoch;
    final title = note.title.isEmpty ? '（空のメモ）' : note.title;
    final snippet = query.isEmpty ? null : searchSnippet(note.body, query, skipFirstLine: true);
    final date = formatDateTime(note.inTrash ? note.deletedAt! : note.updatedAt);
    final titleStyle = TextStyle(fontSize: fontSize, color: c.fg);

    return Semantics( // 読み上げでは1行を1つのまとまりとして伝える
      button: true,
      selected: selected,
      label: [if (note.starred) '☆付き', title, if (upcoming) 'リマインダー ${formatReminder(note.reminderAt!)}', date].join('、'),
      excludeSemantics: true,
      onTap: onTap, // 中身の読み上げを止めたので、操作はここで伝える
      onLongPress: onLongPress,
      onLongPressHint: '選択',
      child: Material(
        color: selected ? scheme.primaryContainer : (c.bg ?? Colors.transparent),
        shape: Border(bottom: BorderSide(color: scheme.outlineVariant, width: 0.5)),
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 6), // 左右は狭めにして1行に入る文字を増やす
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                if (selected) Padding(padding: const EdgeInsets.only(right: 8), child: Icon(Icons.check_circle, size: fontSize * 1.1, color: scheme.primary)),
                if (note.starred)
                  Padding(padding: const EdgeInsets.only(right: 6), child: Icon(Icons.star, size: fontSize * 1.1, color: Colors.amber.shade700)),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: highlightSpans(title, query, titleStyle)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ]),
              if (snippet != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text.rich(
                    TextSpan(children: highlightSpans(snippet, query, TextStyle(fontSize: fontSize * 0.8, color: sub))),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              const SizedBox(height: 2),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [ // 日時は右下（高速メモ帳と同じ）
                if (upcoming) ...[
                  Icon(Icons.alarm, size: 14, color: sub),
                  const SizedBox(width: 4),
                  Text(formatReminder(note.reminderAt!), style: small),
                  const SizedBox(width: 12),
                ],
                Text(date, style: small),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

List<TextSpan> highlightSpans(String text, String query, TextStyle base) { // 検索語を太字にする（大文字小文字を区別しない）
  if (query.isEmpty) return [TextSpan(text: text, style: base)];
  final lower = text.toLowerCase(), q = query.toLowerCase();
  final spans = <TextSpan>[];
  var start = 0;
  for (var i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, start)) {
    if (i > start) spans.add(TextSpan(text: text.substring(start, i), style: base));
    spans.add(TextSpan(text: text.substring(i, i + q.length), style: base.copyWith(fontWeight: FontWeight.bold, decoration: TextDecoration.underline)));
    start = i + q.length;
  }
  if (start < text.length) spans.add(TextSpan(text: text.substring(start), style: base));
  return spans;
}

String? searchSnippet(String body, String query, {bool skipFirstLine = false}) { // 本文で最初に一致した箇所の前後（1行目＝タイトルにしか無ければ出さない）
  final lower = body.toLowerCase(), q = query.toLowerCase();
  final firstLineEnd = body.indexOf('\n');
  final from = skipFirstLine ? (firstLineEnd < 0 ? body.length : firstLineEnd + 1) : 0;
  final i = lower.indexOf(q, from);
  if (i < 0) return null;
  const before = 15, after = 60;
  final s = i - before < from ? from : i - before;
  final e = i + q.length + after > body.length ? body.length : i + q.length + after;
  return '${s > from ? '…' : ''}${body.substring(s, e).replaceAll('\n', ' ')}${e < body.length ? '…' : ''}';
}
