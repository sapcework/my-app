import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'app.dart';
import 'data/note_db.dart';
import 'state/json_file.dart';
import 'state/lock.dart';
import 'state/notes.dart';
import 'state/settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dir = await getApplicationSupportDirectory(); // アプリ専用領域（他アプリから読めない）
  final notes = NotesController(await NoteDb.open());
  final settings = SettingsController(JsonFile(File(p.join(dir.path, 'settings.json'))));
  final lock = LockController(JsonFile(File(p.join(dir.path, 'lock.json'))));
  await Future.wait([notes.load(), settings.load(), lock.load()]);

  runApp(ProviderScope(
    overrides: [
      notesProvider.overrideWith((ref) => notes),
      settingsProvider.overrideWith((ref) => settings),
      lockProvider.overrideWith((ref) => lock),
    ],
    child: const FastNoteApp(),
  ));
}
