import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'note.dart';

// メモの保存先（端末内の SQLite。通信はしない）
class NoteDb {
  static const version = 2; // 1: 最初の版 / 2: フォルダ・☆・ごみ箱・リマインダーを追加

  final Database _db;
  NoteDb(this._db);

  static Future<NoteDb> open({DatabaseFactory? factory, String? path}) async {
    final f = factory ?? databaseFactory; // テストでは sqflite_common_ffi のファクトリを渡す
    final dbPath = path ?? p.join(await f.getDatabasesPath(), 'fastnote.db');
    final db = await f.openDatabase(
      dbPath,
      options: OpenDatabaseOptions(
        version: version,
        onCreate: (db, _) async {
          await db.execute('''
            CREATE TABLE notes (
              id TEXT PRIMARY KEY,
              body TEXT NOT NULL,
              sort_order INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              text_color TEXT,
              bg_color TEXT
            )''');
          await _upgradeTo2(db);
        },
        onUpgrade: (db, from, _) async {
          if (from < 2) await _upgradeTo2(db); // 既存のメモは消さずに列を足す
        },
      ),
    );
    return NoteDb(db);
  }

  static Future<void> _upgradeTo2(Database db) async {
    await db.execute('ALTER TABLE notes ADD COLUMN folder_id TEXT');
    await db.execute('ALTER TABLE notes ADD COLUMN starred INTEGER NOT NULL DEFAULT 0');
    await db.execute('ALTER TABLE notes ADD COLUMN deleted_at INTEGER');
    await db.execute('ALTER TABLE notes ADD COLUMN reminder_at INTEGER');
    await db.execute('CREATE TABLE folders (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL)');
  }

  Future<List<Note>> all() async {
    final rows = await _db.query('notes', orderBy: 'sort_order, created_at');
    return rows.map(Note.fromMap).toList();
  }

  Future<void> upsert(Note n) => _db.insert('notes', n.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> delete(String id) => _db.delete('notes', where: 'id = ?', whereArgs: [id]);

  Future<void> deleteMany(Iterable<String> ids) async { // ごみ箱を空にする
    await _db.transaction((txn) async {
      final b = txn.batch();
      for (final id in ids) {
        b.delete('notes', where: 'id = ?', whereArgs: [id]);
      }
      await b.commit(noResult: true);
    });
  }

  Future<void> insertAll(List<Note> notes, {List<Folder> folders = const []}) async { // 取り込み用。全件まとめて1トランザクション
    await _db.transaction((txn) async {
      final b = txn.batch();
      for (final f in folders) {
        b.insert('folders', f.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final n in notes) {
        b.insert('notes', n.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await b.commit(noResult: true);
    });
  }

  Future<List<Folder>> folders() async => (await _db.query('folders', orderBy: 'sort_order')).map(Folder.fromMap).toList();

  Future<void> upsertFolder(Folder f) => _db.insert('folders', f.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> deleteFolder(String id) async { // 中のメモは「私のノート」へ戻す
    await _db.transaction((txn) async {
      await txn.update('notes', {'folder_id': null}, where: 'folder_id = ?', whereArgs: [id]);
      await txn.delete('folders', where: 'id = ?', whereArgs: [id]);
    });
  }

  Future<void> close() => _db.close();
}
