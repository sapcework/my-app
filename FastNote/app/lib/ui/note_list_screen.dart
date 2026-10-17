import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/colors.dart';
import '../data/note.dart';
import '../state/notes.dart';
import '../state/settings.dart';
import 'note_actions.dart';
import 'note_edit_screen.dart';
import 'settings_screen.dart';
import 'widgets/color_sheet.dart';

final _dateFmt = DateFormat('yyyy/MM/dd HH:mm');

class NoteListScreen extends ConsumerStatefulWidget {
  const NoteListScreen({super.key});

  @override
  ConsumerState<NoteListScreen> createState() => _NoteListScreenState();
}

class _NoteListScreenState extends ConsumerState<NoteListScreen> {
  final _query = TextEditingController();
  bool _searching = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _open(String? id) => Navigator.push(context, MaterialPageRoute(builder: (_) => NoteEditScreen(noteId: id)));

  void _closeSearch() => setState(() {
        _searching = false;
        _query.clear();
      });

  Future<void> _menu(Note note) async { // 長押しメニュー
    final notes = ref.read(notesProvider);
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.palette_outlined), title: const Text('色を変える'), onTap: () => Navigator.pop(context, 'color')),
          ListTile(leading: const Icon(Icons.delete_outline), title: const Text('削除'), onTap: () => Navigator.pop(context, 'delete')),
        ]),
      ),
    );
    if (action == 'delete') await deleteWithUndo(notes, note);
    if (action == 'color' && mounted) {
      await showColorSheet(context, bg: note.bgColor, fg: note.textColor, onChanged: (bg, fg) => notes.updateColors(note.id, bg: bg, fg: fg));
    }
  }

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(notesProvider);
    final settings = ref.watch(settingsProvider);
    final list = notes.view(settings.sort, _query.text);
    final canReorder = settings.sort == SortMode.manual && _query.text.trim().isEmpty;

    Widget tile(Note n, int index) => NoteTile(
          key: ValueKey(n.id),
          note: n,
          fontSize: settings.fontSize,
          onTap: () => _open(n.id),
          onLongPress: () => _menu(n),
          trailing: canReorder
              ? ReorderableDragStartListener(
                  index: index,
                  child: const Padding(padding: EdgeInsets.all(8), child: Icon(Icons.drag_handle, semanticLabel: 'ドラッグで並べ替え')),
                )
              : null,
        );

    return PopScope(
      canPop: !_searching, // 検索中の戻るは検索を閉じるだけ
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _closeSearch();
      },
      child: Scaffold(
        appBar: AppBar(
          title: _searching
              ? TextField(
                  controller: _query,
                  autofocus: true,
                  decoration: const InputDecoration(hintText: '検索', border: InputBorder.none),
                  onChanged: (_) => setState(() {}),
                )
              : Text('メモ（${notes.notes.length}）'),
          actions: [
            IconButton(
              tooltip: _searching ? '検索を閉じる' : '検索',
              icon: Icon(_searching ? Icons.close : Icons.search),
              onPressed: () => _searching ? _closeSearch() : setState(() => _searching = true),
            ),
            PopupMenuButton<SortMode>(
              tooltip: '並び順',
              icon: const Icon(Icons.sort),
              onSelected: settings.setSort,
              itemBuilder: (_) => [
                for (final m in SortMode.values)
                  CheckedPopupMenuItem(value: m, checked: m == settings.sort, child: Text(m.label)),
              ],
            ),
            IconButton(
              tooltip: '設定',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
            ),
          ],
        ),
        body: list.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(
                    notes.notes.isEmpty ? 'メモはまだありません。\n右下の＋で作成するか、設定から高速メモ帳のバックアップを取り込めます。' : '「${_query.text}」を含むメモはありません',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : canReorder
                ? ReorderableListView.builder(
                    buildDefaultDragHandles: false, // 長押しはメニューに使うので、つまみでだけ動かす
                    padding: const EdgeInsets.only(bottom: 88),
                    itemCount: list.length,
                    onReorderItem: notes.reorder, // 移動後の位置に補正済みの添字が渡る
                    itemBuilder: (_, i) => tile(list[i], i),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 88), // FAB に最後の行が隠れないように
                    itemCount: list.length,
                    itemBuilder: (_, i) => tile(list[i], i),
                  ),
        floatingActionButton: FloatingActionButton(
          tooltip: '新しいメモ',
          onPressed: () => _open(null),
          child: const Icon(Icons.add),
        ),
      ),
    );
  }
}

class NoteTile extends StatelessWidget {
  final Note note;
  final double fontSize;
  final VoidCallback onTap, onLongPress;
  final Widget? trailing;

  const NoteTile({super.key, required this.note, required this.fontSize, required this.onTap, required this.onLongPress, this.trailing});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = noteColors(note.bgColor, note.textColor);
    final sub = c.fg?.withValues(alpha: 0.7) ?? theme.colorScheme.onSurfaceVariant;
    final preview = note.preview;

    return Material(
      color: c.bg ?? Colors.transparent,
      shape: Border(bottom: BorderSide(color: theme.colorScheme.outlineVariant, width: 0.5)),
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 10, trailing == null ? 16 : 4, 10),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  note.title.isEmpty ? '（空のメモ）' : note.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.bold, color: c.fg),
                ),
                if (preview.isNotEmpty)
                  Text(preview, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: fontSize * 0.85, color: sub)),
                const SizedBox(height: 2),
                Text(_dateFmt.format(DateTime.fromMillisecondsSinceEpoch(note.updatedAt)), style: theme.textTheme.bodySmall?.copyWith(color: sub)),
              ]),
            ),
            ?trailing,
          ]),
        ),
      ),
    );
  }
}
