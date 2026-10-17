import 'package:flutter/material.dart';

import '../app.dart';
import '../data/note.dart';
import '../state/notes.dart';

Future<void> deleteWithUndo(NotesController notes, Note note) async { // 確認ダイアログの代わりに「元に戻す」を出す
  await notes.delete(note.id);
  final title = note.title.isEmpty ? '空のメモ' : note.title;
  scaffoldMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text('「$title」を削除しました', maxLines: 1, overflow: TextOverflow.ellipsis),
      duration: const Duration(seconds: 6),
      action: SnackBarAction(label: '元に戻す', onPressed: () => notes.restore(note)),
    ));
}

void showMessage(String text) {
  scaffoldMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}
