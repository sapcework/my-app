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

  Future<Note> updateBody(String id, String body) => _put(byId(id)!.copyWith(body: body, updatedAt: _now()));

  Future<Note> updateColors(String id, {required String? bg, required String? fg}) => // 色・☆・フォルダの変更では更新日時を変えない（並びが動かないように）
      _put(byId(id)!.copyWith(bgColor: () => bg, textColor: () => fg));

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

  Future<Note> setStarred(String id, bool v) => _put(byId(id)!.copyWith(starred: v));

  Future<Note> moveToFolder(String id, String? folderId) => _put(byId(id)!.copyWith(folderId: () => folderId));

  Future<Note> setReminder(String id, int? at) async {
    final n = await _put(byId(id)!.copyWith(reminderAt: () => at));
    if (at == null) {
      await _reminders.cancel(n);
    } else {
      await _reminders.schedule(n);
    }
    return n;
  }

  Future<Note> moveToTrash(String id) async {
    final n = await _put(byId(id)!.copyWith(deletedAt: () => _now()));
    if (n.reminderAt != null) await _reminders.cancel(n); // ごみ箱のメモは通知しない
    return n;
  }

  Future<Note> restoreFromTrash(String id) async {
    final n = await _put(byId(id)!.copyWith(deletedAt: () => null, folderId: () => folderById(byId(id)!.folderId)?.id)); // フォルダが消えていたら「マイノート」へ
    if (n.reminderAt != null && n.reminderAt! > _now()) await _reminders.schedule(n);
    return n;
  }

  Future<void> restore(Note n) async { // 操作の取り消し（削除前の状態にそのまま戻す）
    await _put(n, added: byId(n.id) == null);
    if (n.reminderAt != null && !n.inTrash && n.reminderAt! > _now()) await _reminders.schedule(n);
  }

  Future<void> deletePermanently(String id) async {
    final n = byId(id);
    _notes.removeWhere((x) => x.id == id);
    notifyListeners();
    await _db.delete(id);
    if (n?.reminderAt != null) await _reminders.cancel(n!);
  }

  Future<int> emptyTrash() async {
    final ids = [for (final n in _notes) if (n.inTrash) n.id];
    _notes.removeWhere((n) => n.inTrash);
    notifyListeners();
    await _db.deleteMany(ids);
    return ids.length;
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
        existingFolders: {for (final f in _folders) f.name: f.id},
        startOrder: _nextOrder(),
        nowMs: _now(),
      );

  Future<void> applyImport(ImportPlan plan) async {
    final base = _folders.isEmpty ? 0 : _folders.last.sortOrder + 1;
    final folders = [for (final (i, f) in plan.newFolders.indexed) f.copyWith(sortOrder: base + i)]; // 既存フォルダの後ろに並べ直す
    await _db.insertAll(plan.notes, folders: folders);
    _folders = [..._folders, ...folders];
    _notes = [..._notes, ...plan.notes];
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
