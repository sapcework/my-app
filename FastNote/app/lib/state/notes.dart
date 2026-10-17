import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../data/note.dart';
import '../data/note_csv.dart';
import '../data/note_db.dart';
import 'settings.dart';

// メモ一覧の状態。件数は多くても数千件の想定なので全件をメモリに持つ
class NotesController extends ChangeNotifier {
  final NoteDb _db;
  final int Function() _now; // テストで時刻を固定できるように
  NotesController(this._db, {int Function()? now}) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  List<Note> _notes = []; // sort_order 順

  List<Note> get notes => List.unmodifiable(_notes);

  Note? byId(String id) {
    for (final n in _notes) {
      if (n.id == id) return n;
    }
    return null;
  }

  Future<void> load() async {
    _notes = await _db.all();
    notifyListeners();
  }

  List<Note> view(SortMode mode, String query) { // 画面に出す並びと絞り込み
    final q = query.trim().toLowerCase();
    final list = q.isEmpty ? List.of(_notes) : _notes.where((n) => n.body.toLowerCase().contains(q)).toList();
    switch (mode) {
      case SortMode.manual:
        break; // _notes は既に sort_order 順
      case SortMode.updatedDesc:
        list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      case SortMode.updatedAsc:
        list.sort((a, b) => a.updatedAt.compareTo(b.updatedAt));
      case SortMode.title:
        list.sort((a, b) => a.title.compareTo(b.title));
    }
    return list;
  }

  Future<Note> create(String body) async { // 新しいメモは一番上に置く
    final now = _now();
    final top = _notes.isEmpty ? 0 : _notes.first.sortOrder - 1;
    final n = Note(id: _uniqueId(), body: body, sortOrder: top, createdAt: now, updatedAt: now);
    _notes.insert(0, n);
    notifyListeners();
    await _db.upsert(n);
    return n;
  }

  Future<Note> updateBody(String id, String body) async {
    final n = byId(id)!.copyWith(body: body, updatedAt: _now());
    return _replace(n);
  }

  Future<Note> updateColors(String id, {required String? bg, required String? fg}) async { // 色だけの変更は更新日時を変えない
    final n = byId(id)!.copyWith(bgColor: () => bg, textColor: () => fg);
    return _replace(n);
  }

  Future<Note> _replace(Note n) async {
    final i = _notes.indexWhere((x) => x.id == n.id);
    _notes[i] = n;
    notifyListeners();
    await _db.upsert(n);
    return n;
  }

  Future<void> delete(String id) async {
    _notes.removeWhere((n) => n.id == id);
    notifyListeners();
    await _db.delete(id);
  }

  Future<void> restore(Note n) async { // 削除の取り消し。元の位置に戻す
    _notes.add(n);
    _notes.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    notifyListeners();
    await _db.upsert(n);
  }

  Future<void> reorder(int oldIndex, int newIndex) async { // 手動並べ替え（newIndex は移動後の位置）
    final n = _notes.removeAt(oldIndex);
    _notes.insert(newIndex, n);
    _notes = [for (final (i, x) in _notes.indexed) x.copyWith(sortOrder: i)]; // 0 から振り直す
    notifyListeners();
    await _db.updateOrders({for (final x in _notes) x.id: x.sortOrder});
  }

  ImportPlan planImportFrom(String text) => planImport( // 高速メモ帳のバックアップか CSV かは中身で判断する
        text,
        existingIds: {for (final n in _notes) n.id},
        startOrder: _notes.isEmpty ? 0 : _notes.last.sortOrder + 1, // 既存メモの後ろに並べる
        nowMs: _now(),
      );

  Future<void> applyImport(ImportPlan plan) async {
    await _db.insertAll(plan.notes);
    _notes = [..._notes, ...plan.notes];
    notifyListeners();
  }

  String exportCsv() => notesToCsv(_notes);

  String _uniqueId() {
    final ids = {for (final n in _notes) n.id};
    var id = newNoteId();
    while (ids.contains(id)) {
      id = newNoteId();
    }
    return id;
  }
}

final notesProvider = ChangeNotifierProvider<NotesController>((ref) => throw UnimplementedError('main で override する'));
