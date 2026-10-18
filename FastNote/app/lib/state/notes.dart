import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../data/note.dart';
import '../data/note_csv.dart';
import '../data/note_db.dart';
import 'reminders.dart';
import 'settings.dart';

// 一覧に表示する範囲。フォルダ（null は「マイノート」）か、ごみ箱
@immutable
class NoteScope {
  final String? folderId;
  final bool trash;
  const NoteScope.folder(this.folderId) : trash = false;
  const NoteScope.trash()
      : folderId = null,
        trash = true;
  static const home = NoteScope.folder(null);

  bool contains(Note n) => trash ? n.inTrash : !n.inTrash && n.folderId == folderId;

  @override
  bool operator ==(Object other) => other is NoteScope && other.folderId == folderId && other.trash == trash;
  @override
  int get hashCode => Object.hash(folderId, trash);
}

// メモとフォルダの状態。件数は多くても数千件の想定なので全件をメモリに持つ
class NotesController extends ChangeNotifier {
  final NoteDb _db;
  final ReminderScheduler _reminders;
  final int Function() _now; // テストで時刻を固定できるように
  NotesController(this._db, {ReminderScheduler? reminders, int Function()? now})
      : _reminders = reminders ?? const NoReminders(),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  List<Note> _notes = [];
  List<Folder> _folders = [];

  List<Note> get notes => List.unmodifiable(_notes);
  List<Folder> get folders => List.unmodifiable(_folders);

  Note? byId(String id) {
    for (final n in _notes) {
      if (n.id == id) return n;
    }
    return null;
  }

  Folder? folderById(String? id) {
    for (final f in _folders) {
      if (f.id == id) return f;
    }
    return null;
  }

  String scopeName(NoteScope s) => s.trash ? 'ごみ箱' : folderById(s.folderId)?.name ?? defaultFolderName;

  int count(NoteScope s) => _notes.where(s.contains).length;

  Future<void> load() async {
    _notes = await _db.all();
    _folders = await _db.folders();
    if (_folders.isNotEmpty) { // 消えたフォルダを指すメモは「マイノート」に見せる（DB はそのまま）
      final ids = {for (final f in _folders) f.id};
      _notes = [for (final n in _notes) n.folderId != null && !ids.contains(n.folderId) ? n.copyWith(folderId: () => null) : n];
    } else {
      _notes = [for (final n in _notes) n.folderId != null ? n.copyWith(folderId: () => null) : n];
    }
    notifyListeners();
  }

  List<Note> view(NoteScope scope, SortMode mode, String query) { // 画面に出す並びと絞り込み
    final q = query.trim().toLowerCase();
    final list = _notes.where((n) => scope.contains(n) && (q.isEmpty || n.body.toLowerCase().contains(q))).toList();
    if (scope.trash) {
      list.sort((a, b) => b.deletedAt!.compareTo(a.deletedAt!)); // ごみ箱は捨てた順
      return list;
    }
    int byMode(Note a, Note b) => switch (mode) {
          SortMode.updatedDesc => b.updatedAt.compareTo(a.updatedAt),
          SortMode.createdDesc => b.createdAt.compareTo(a.createdAt),
          SortMode.title => a.title.compareTo(b.title),
        };
    list.sort((a, b) {
      if (a.starred != b.starred) return a.starred ? -1 : 1; // ☆は先頭に固定
      final c = byMode(a, b);
      return c != 0 ? c : a.sortOrder.compareTo(b.sortOrder);
    });
    return list;
  }

  // ---- メモ ----

  Future<Note> create(String body, {String? folderId}) async {
    final now = _now();
    final n = Note(id: _uniqueId(), body: body, sortOrder: _nextOrder(), createdAt: now, updatedAt: now, folderId: folderId);
    return _put(n, added: true);
  }

  // 操作の対象が見つからない（別の画面で消された）ときは何もしない。例外で落とさない

  Future<Note?> updateBody(String id, String body) => _edit(id, (n) => n.copyWith(body: body, updatedAt: _now()));

  Future<Note?> updateColors(String id, {required String? bg, required String? fg}) => // 色・☆・フォルダの変更では更新日時を変えない（並びが動かないように）
      _edit(id, (n) => n.copyWith(bgColor: () => bg, textColor: () => fg));

  int get coloredCount => _notes.where((n) => n.textColor != null || n.bgColor != null).length;

  Future<int> clearAllColors() async { // 色の付いたメモをすべて既定の色に戻す（更新日時は変えないので並びは動かない）
    final ids = [for (final n in _notes) if (n.textColor != null || n.bgColor != null) n.id];
    if (ids.isEmpty) return 0;
    final set = ids.toSet();
    _notes = [for (final n in _notes) set.contains(n.id) ? n.copyWith(textColor: () => null, bgColor: () => null) : n];
    notifyListeners();
    await _db.clearColors(ids);
    return ids.length;
  }

  Future<Note?> setStarred(String id, bool v) => _edit(id, (n) => n.copyWith(starred: v));

  Future<Note?> moveToFolder(String id, String? folderId) => _edit(id, (n) => n.copyWith(folderId: () => folderId));

  Future<Note?> setReminder(String id, int? at) async {
    final n = await _edit(id, (n) => n.copyWith(reminderAt: () => at));
    if (n == null) return null;
    if (at == null) {
      await _cancelReminder(n);
    } else {
      await _reminders.schedule(n);
    }
    return n;
  }

  Future<Note?> moveToTrash(String id) async => (await trashMany([id])).firstOrNull;

  Future<Note?> restoreFromTrash(String id) async => (await restoreManyFromTrash([id])).firstOrNull;

  Future<void> restore(Note n) => restoreAll([n]);

  Future<void> deletePermanently(String id) => deleteManyPermanently([id]);

  // ---- まとめて操作（一覧の「まとめて選択」から使う。DB への書き込みは1回にまとめる）----

  Future<void> setStarredMany(Iterable<String> ids, bool v) => _editMany(ids, (n) => n.copyWith(starred: v));

  Future<void> moveManyToFolder(Iterable<String> ids, String? folderId) => _editMany(ids, (n) => n.copyWith(folderId: () => folderId));

  Future<void> updateColorsMany(Iterable<String> ids, {required String? bg, required String? fg}) =>
      _editMany(ids, (n) => n.copyWith(bgColor: () => bg, textColor: () => fg));

  Future<List<Note>> trashMany(Iterable<String> ids) async { // ごみ箱へ移す。戻り値は移す前の状態（「元に戻す」に使う）
    final before = [for (final id in ids) ?byId(id)].where((n) => !n.inTrash).toList();
    final now = _now();
    await _editMany(before.map((n) => n.id), (n) => n.copyWith(deletedAt: () => now));
    for (final n in before) {
      if (n.reminderAt != null) await _cancelReminder(n); // ごみ箱のメモは通知しない
    }
    return before;
  }

  Future<List<Note>> restoreManyFromTrash(Iterable<String> ids) async {
    final restored = await _editMany(ids, (n) => n.copyWith(deletedAt: () => null, folderId: () => folderById(n.folderId)?.id)); // フォルダが消えていたら「マイノート」へ
    for (final n in restored) {
      if (n.reminderAt != null && n.reminderAt! > _now()) await _reminders.schedule(n);
    }
    return restored;
  }

  Future<void> restoreAll(List<Note> notes) async { // 操作の取り消し（操作前の状態にそのまま戻す）
    if (notes.isEmpty) return;
    final byIdNow = {for (final (i, n) in _notes.indexed) n.id: i};
    for (final n in notes) {
      final i = byIdNow[n.id];
      if (i == null) {
        _notes.add(n);
      } else {
        _notes[i] = n;
      }
    }
    notifyListeners();
    await _db.insertAll(notes);
    for (final n in notes) {
      if (n.reminderAt != null && !n.inTrash && n.reminderAt! > _now()) await _reminders.schedule(n);
    }
  }

  Future<void> deleteManyPermanently(Iterable<String> ids) async {
    final gone = [for (final id in ids) ?byId(id)];
    if (gone.isEmpty) return;
    final set = {for (final n in gone) n.id};
    _notes.removeWhere((x) => set.contains(x.id));
    notifyListeners();
    await _db.deleteMany(set);
    for (final n in gone) {
      if (n.reminderAt != null) await _cancelReminder(n);
    }
  }

  Future<int> emptyTrash() async {
    final ids = [for (final n in _notes) if (n.inTrash) n.id];
    _notes.removeWhere((n) => n.inTrash);
    notifyListeners();
    await _db.deleteMany(ids);
    return ids.length;
  }

  Future<void> _cancelReminder(Note n) async { // 通知の取り消しに失敗しても、メモの操作は続ける（ログには残す）
    try {
      await _reminders.cancel(n);
    } catch (e) {
      debugPrint('リマインダーを取り消せませんでした: $e');
    }
  }

  Future<Note?> _edit(String id, Note Function(Note) change) async {
    final n = byId(id);
    return n == null ? null : _put(change(n));
  }

  Future<List<Note>> _editMany(Iterable<String> ids, Note Function(Note) change) async {
    final set = ids.toSet();
    final changed = <Note>[];
    _notes = [
      for (final n in _notes)
        if (set.contains(n.id)) (changed..add(change(n))).last else n,
    ];
    if (changed.isEmpty) return changed;
    notifyListeners();
    await _db.insertAll(changed); // 同じ ID は置き換えになる（1トランザクション）
    return changed;
  }

  Future<Note> _put(Note n, {bool added = false}) async {
    if (added) {
      _notes.add(n);
    } else {
      _notes[_notes.indexWhere((x) => x.id == n.id)] = n;
    }
    notifyListeners();
    await _db.upsert(n);
    return n;
  }

  // ---- フォルダ ----

  Future<Folder> createFolder(String name) async {
    final f = Folder(id: _uniqueId(), name: name.trim(), sortOrder: _folders.isEmpty ? 0 : _folders.last.sortOrder + 1);
    _folders.add(f);
    notifyListeners();
    await _db.upsertFolder(f);
    return f;
  }

  Future<void> renameFolder(String id, String name) async {
    final i = _folders.indexWhere((f) => f.id == id);
    _folders[i] = _folders[i].copyWith(name: name.trim());
    notifyListeners();
    await _db.upsertFolder(_folders[i]);
  }

  Future<void> deleteFolder(String id) async { // 中のメモは「マイノート」へ（ごみ箱のメモも、戻したときに「マイノート」へ入る）
    _folders.removeWhere((f) => f.id == id);
    _notes = [for (final n in _notes) n.folderId == id ? n.copyWith(folderId: () => null) : n];
    notifyListeners();
    await _db.deleteFolder(id);
  }

  // ---- 取り込み・書き出し ----

  ImportPlan planImportFrom(String text) => planImport( // 高速メモ帳のバックアップか CSV かは中身で判断する
        text,
        existingIds: {for (final n in _notes) n.id},
        existingNotes: {for (final n in _notes) n.id: n},
        existingFolders: {for (final f in _folders) f.name: f.id},
        startOrder: _nextOrder(),
        nowMs: _now(),
      );

  Future<void> applyImport(ImportPlan plan) async {
    final base = _folders.isEmpty ? 0 : _folders.last.sortOrder + 1;
    final folders = [for (final (i, f) in plan.newFolders.indexed) f.copyWith(sortOrder: base + i)]; // 既存フォルダの後ろに並べ直す
    await _db.insertAll([...plan.notes, ...plan.updates], folders: folders);
    _folders = [..._folders, ...folders];
    final updated = {for (final n in plan.updates) n.id: n};
    _notes = [for (final n in _notes) updated[n.id] ?? n, ...plan.notes];
    notifyListeners();
    for (final n in plan.notes) {
      if (n.reminderAt != null && !n.inTrash && n.reminderAt! > _now()) await _reminders.schedule(n);
    }
  }

  String exportCsv() => notesToCsv(
        [..._notes]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)),
        folderName: (id) => folderById(id)?.name ?? '',
      );

  int _nextOrder() => _notes.isEmpty ? 0 : _notes.map((n) => n.sortOrder).reduce((a, b) => a > b ? a : b) + 1;

  String _uniqueId() {
    final ids = {for (final n in _notes) n.id, for (final f in _folders) f.id};
    var id = newNoteId();
    while (ids.contains(id)) {
      id = newNoteId();
    }
    return id;
  }
}

final notesProvider = ChangeNotifierProvider<NotesController>((ref) => throw UnimplementedError('main で override する'));
