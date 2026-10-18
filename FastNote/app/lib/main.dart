import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'app.dart';
import 'core/export_files.dart';
import 'data/note_db.dart';
import 'state/json_file.dart';
import 'state/lock.dart';
import 'state/notes.dart';
import 'state/reminders.dart';
import 'state/settings.dart';
import 'ui/startup_error_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    runApp(await _start());
  } catch (e, st) { // 起動に失敗しても白い画面で止まらないように、原因と対処を出す
    debugPrint('起動に失敗しました: $e\n$st');
    runApp(StartupErrorApp(error: e));
  }
}

Future<Widget> _start() async {
  final dir = await getApplicationSupportDirectory(); // アプリ専用領域（他アプリから読めない）
  final reminders = await _initReminders();
  final notes = NotesController(await NoteDb.open(), reminders: reminders);
  final settings = SettingsController(JsonFile(File(p.join(dir.path, 'settings.json'))));
  final lock = LockController(JsonFile(File(p.join(dir.path, 'lock.json'))));
  await Future.wait([notes.load(), settings.load(), lock.load(), _deleteLeftoverExports()]);
  if (reminders is LocalReminders) openNoteRequest.value = await reminders.launchedNoteId(); // 通知のタップで起動したなら、そのメモを開く

  return ProviderScope(
    overrides: [
      notesProvider.overrideWith((ref) => notes),
      settingsProvider.overrideWith((ref) => settings),
      lockProvider.overrideWith((ref) => lock),
      remindersProvider.overrideWithValue(reminders),
    ],
    child: const FastNoteApp(),
  );
}

Future<ReminderScheduler> _initReminders() async { // 通知が使えなくても、メモは使えるようにする
  try {
    final r = LocalReminders(onOpen: (id) => openNoteRequest.value = id);
    await r.init();
    return r;
  } catch (e) {
    debugPrint('通知を初期化できなかったため、リマインダーなしで起動します: $e');
    return const NoReminders();
  }
}

Future<void> _deleteLeftoverExports() async { // 前回書き出したファイル（平文の CSV を含む）をキャッシュに残さない
  try {
    final dir = await getTemporaryDirectory();
    await for (final f in dir.list()) {
      if (f is File && isExportFileName(p.basename(f.path))) await f.delete();
    }
  } catch (e) {
    debugPrint('書き出しファイルの後片付けに失敗しました: $e'); // 次の書き出しのときにも消すので、起動は続ける
  }
}
