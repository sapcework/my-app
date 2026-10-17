import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'note.dart';

// メモの保存先（端末内の SQLite。通信はしない）
class NoteDb {
  final Database _db;
  NoteDb(this._db);

  static Future<NoteDb> open({DatabaseFactory? factory, String? path}) async {
    final f = factory ?? databaseFactory; // テストでは sqflite_common_ffi のファクトリを渡す
    final dbPath = path ?? p.join(await f.getDatabasesPath(), 'fastnote.db');
    final db = await f.openDatabase(
      dbPath,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, _) => db.execute('''
          CREATE TABLE notes (
            id TEXT PRIMARY KEY,
            body TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            text_color TEXT,
            bg_color TEXT
          )'''),
      ),
    );
    return NoteDb(db);
  }

  Future<List<Note>> all() async {
    final rows = await _db.query('notes', orderBy: 'sort_order, created_at');
    return rows.map(Note.fromMap).toList();
  }

  Future<void> upsert(Note n) => _db.insert('notes', n.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> delete(String id) => _db.delete('notes', where: 'id = ?', whereArgs: [id]);

  Future<void> insertAll(List<Note> notes) async { // 取り込み用。全件まとめて1トランザクション
    await _db.transaction((txn) async {
      final b = txn.batch();
      for (final n in notes) {
        b.insert('notes', n.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await b.commit(noResult: true);
    });
  }

  Future<void> updateOrders(Map<String, int> orders) async { // id → sort_order
    await _db.transaction((txn) async {
      final b = txn.batch();
      orders.forEach((id, order) => b.update('notes', {'sort_order': order}, where: 'id = ?', whereArgs: [id]));
      await b.commit(noResult: true);
    });
  }

  Future<void> close() => _db.close();
}
