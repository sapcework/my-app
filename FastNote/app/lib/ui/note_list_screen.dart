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
import 'widgets/theme_dialog.dart';

// メモ一覧（高速メモ帳と同じく、左の ≡ でフォルダ・ごみ箱・色・設定のメニューを開く）
class NoteListScreen extends ConsumerStatefulWidget {
  const NoteListScreen({super.key});

  @override
  ConsumerState<NoteListScreen> createState() => _NoteListScreenState();
}

class _NoteListScreenState extends ConsumerState<NoteListScreen> {
  final _query = TextEditingController();
  bool _searching = false;
  NoteScope _scope = NoteScope.home;

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

  void _select(NoteScope s) {
    Navigator.pop(context); // メニューを閉じる
    setState(() => _scope = s);
  }

  Future<void> _noteMenu(Note note) async { // 長押しメニュー
    final notes = ref.read(notesProvider);
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (note.inTrash) ...[
            ListTile(leading: const Icon(Icons.restore), title: const Text('元に戻す'), onTap: () => Navigator.pop(context, 'restore')),
            ListTile(leading: const Icon(Icons.delete_forever_outlined), title: const Text('完全に削除'), onTap: () => Navigator.pop(context, 'purge')),
          ] else ...[
            ListTile(
              leading: Icon(note.starred ? Icons.star : Icons.star_border),
              title: Text(note.starred ? '☆を外す' : '☆を付ける（先頭に固定）'),
              onTap: () => Navigator.pop(context, 'star'),
            ),
            ListTile(leading: const Icon(Icons.palette_outlined), title: const Text('色'), onTap: () => Navigator.pop(context, 'color')),
            ListTile(leading: const Icon(Icons.drive_file_move_outlined), title: const Text('フォルダへ移動'), onTap: () => Navigator.pop(context, 'move')),
            ListTile(leading: const Icon(Icons.delete_outline), title: const Text('削除（ごみ箱へ）'), onTap: () => Navigator.pop(context, 'trash')),
          ],
        ]),
      ),
    );
    if (!mounted) return;
    switch (action) {
      case 'star':
        await notes.setStarred(note.id, !note.starred);
      case 'color':
        await showColorSheet(context, bg: note.bgColor, fg: note.textColor, onChanged: (bg, fg) => notes.updateColors(note.id, bg: bg, fg: fg));
      case 'move':
        await moveToFolderDialog(context, notes, note);
      case 'trash':
        await trashWithUndo(notes, note);
      case 'restore':
        await notes.restoreFromTrash(note.id);
        showMessage('「${noteLabel(note)}」を元に戻しました');
      case 'purge':
        if (await _confirm('完全に削除', '「${noteLabel(note)}」を完全に削除します。元に戻せません。')) await notes.deletePermanently(note.id);
    }
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
          onTap: () => _select(s),
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

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notesProvider);
    final settings = ref.watch(settingsProvider);
    if (!_scope.trash && _scope.folderId != null && notes.folderById(_scope.folderId) == null) _scope = NoteScope.home; // フォルダが消えていたら戻る
    final list = notes.view(_scope, settings.sort, _query.text);
    final barFg = Theme.of(context).appBarTheme.foregroundColor;

    return PopScope(
      canPop: !_searching, // 検索中の戻るは検索を閉じるだけ
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _closeSearch();
      },
      child: Scaffold(
        drawer: _drawer(notes),
        appBar: AppBar(
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
        ),
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
            : ListView.builder(
                padding: const EdgeInsets.only(bottom: 88), // FAB に最後の行が隠れないように
                itemCount: list.length,
                itemBuilder: (_, i) => NoteTile(
                  key: ValueKey(list[i].id),
                  note: list[i],
                  fontSize: settings.fontSize,
                  onTap: () => list[i].inTrash ? _noteMenu(list[i]) : _open(list[i].id), // ごみ箱のメモは開かずに戻す・消すを選ぶ
                  onLongPress: () => _noteMenu(list[i]),
                ),
              ),
        floatingActionButton: _scope.trash
            ? null
            : FloatingActionButton(tooltip: '新しいメモ', onPressed: () => _open(null), child: const Icon(Icons.add)),
      ),
    );
  }
}

class NoteTile extends StatelessWidget {
  final Note note;
  final double fontSize;
  final VoidCallback onTap, onLongPress;

  const NoteTile({super.key, required this.note, required this.fontSize, required this.onTap, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = noteColors(note.bgColor, note.textColor);
    final sub = c.fg?.withValues(alpha: 0.7) ?? theme.colorScheme.onSurfaceVariant;
    final small = theme.textTheme.bodySmall?.copyWith(color: sub);
    final upcoming = note.reminderAt != null && !note.inTrash && note.reminderAt! > DateTime.now().millisecondsSinceEpoch;

    return Material(
      color: c.bg ?? Colors.transparent,
      shape: Border(bottom: BorderSide(color: theme.colorScheme.outlineVariant, width: 0.5)),
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              if (note.starred)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Icon(Icons.star, size: fontSize * 1.1, color: Colors.amber.shade700, semanticLabel: '☆'),
                ),
              Expanded(
                child: Text(
                  note.title.isEmpty ? '（空のメモ）' : note.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: fontSize, color: c.fg),
                ),
              ),
            ]),
            const SizedBox(height: 2),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [ // 日時は右下（高速メモ帳と同じ）
              if (upcoming) ...[
                Icon(Icons.alarm, size: 14, color: sub, semanticLabel: 'リマインダーあり'),
                const SizedBox(width: 4),
                Text(formatReminder(note.reminderAt!), style: small),
                const SizedBox(width: 12),
              ],
              Text(formatDateTime(note.inTrash ? note.deletedAt! : note.updatedAt), style: small),
            ]),
          ]),
        ),
      ),
    );
  }
}
