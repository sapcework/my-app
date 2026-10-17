import 'package:flutter/material.dart';

import '../app.dart';
import '../data/note.dart';
import '../state/notes.dart';
import '../state/reminders.dart';

void showMessage(String text, {SnackBarAction? action}) {
  scaffoldMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis), action: action));
}

String noteLabel(Note n) => n.title.isEmpty ? '空のメモ' : n.title;

Future<void> trashWithUndo(NotesController notes, Note note) async { // 確認ダイアログの代わりに「元に戻す」を出す
  await notes.moveToTrash(note.id);
  showMessage('「${noteLabel(note)}」をごみ箱に移しました', action: SnackBarAction(label: '元に戻す', onPressed: () => notes.restore(note)));
}

String formatDateTime(int ms) { // 高速メモ帳と同じ「2019/02/26 午後4:52:20」の形
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  String p(int n) => n.toString().padLeft(2, '0');
  final h12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.year}/${p(d.month)}/${p(d.day)} ${d.hour < 12 ? '午前' : '午後'}$h12:${p(d.minute)}:${p(d.second)}';
}

String formatReminder(int ms) { // 秒は出さない
  final s = formatDateTime(ms);
  return s.substring(0, s.lastIndexOf(':'));
}

Future<String?> askFolderName(BuildContext context, {String title = '新しいフォルダ', String initial = ''}) {
  final c = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: c,
        autofocus: true,
        decoration: const InputDecoration(hintText: 'フォルダ名'),
        onSubmitted: (v) => Navigator.pop(context, v),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('キャンセル')),
        TextButton(onPressed: () => Navigator.pop(context, c.text), child: const Text('OK')),
      ],
    ),
  ).then((v) => v == null || v.trim().isEmpty || v.trim() == defaultFolderName ? null : v.trim()); // 空と「私のノート」は作らない
}

Future<void> moveToFolderDialog(BuildContext context, NotesController notes, Note note) async { // 移動先のフォルダを選ぶ
  const newFolder = '__new__'; // 「新しいフォルダ」を選んだ印（フォルダ ID は英小文字と数字だけなので重ならない）
  final picked = await showDialog<(String?,)>(
    context: context,
    builder: (context) => SimpleDialog(
      title: const Text('フォルダへ移動'),
      children: [
        for (final (id, name) in [(null, defaultFolderName), for (final f in notes.folders) (f.id, f.name)])
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, (id,)),
            child: Row(children: [
              Icon(id == note.folderId ? Icons.radio_button_checked : Icons.radio_button_off, size: 20),
              const SizedBox(width: 12),
              Expanded(child: Text(name)),
            ]),
          ),
        SimpleDialogOption(
          onPressed: () => Navigator.pop(context, (newFolder,)),
          child: const Row(children: [Icon(Icons.create_new_folder_outlined, size: 20), SizedBox(width: 12), Text('新しいフォルダ…')]),
        ),
      ],
    ),
  );
  if (picked == null || !context.mounted) return;
  var target = picked.$1;
  if (target == newFolder) {
    final name = await askFolderName(context);
    if (name == null) return;
    target = (await notes.createFolder(name)).id;
  }
  if (target == note.folderId) return;
  await notes.moveToFolder(note.id, target);
  showMessage('「${notes.scopeName(NoteScope.folder(target))}」へ移動しました');
}

Future<void> editReminder(BuildContext context, NotesController notes, ReminderScheduler reminders, Note note) async {
  if (note.reminderAt != null) { // 設定済みなら、変えるか消すかを選ぶ
    final action = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('リマインダー'),
        content: Text(formatReminder(note.reminderAt!)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, 'clear'), child: const Text('解除')),
          TextButton(onPressed: () => Navigator.pop(context, 'change'), child: const Text('変更')),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('閉じる')),
        ],
      ),
    );
    if (action == 'clear') {
      await notes.setReminder(note.id, null);
      showMessage('リマインダーを解除しました');
    }
    if (action != 'change' || !context.mounted) return;
  }
  final now = DateTime.now();
  final initial = note.reminderAt != null && note.reminderAt! > now.millisecondsSinceEpoch
      ? DateTime.fromMillisecondsSinceEpoch(note.reminderAt!)
      : now.add(const Duration(hours: 1));
  final date = await showDatePicker(context: context, initialDate: initial, firstDate: DateTime(now.year, now.month, now.day), lastDate: DateTime(now.year + 10));
  if (date == null || !context.mounted) return;
  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
  if (time == null || !context.mounted) return;
  final at = DateTime(date.year, date.month, date.day, time.hour, time.minute);
  if (!at.isAfter(DateTime.now())) {
    showMessage('過ぎた日時は設定できません');
    return;
  }
  if (!await reminders.requestPermission()) {
    showMessage('通知が許可されていないため、時刻になっても知らせることができません。端末の設定で FastNote の通知を許可してください');
  }
  await notes.setReminder(note.id, at.millisecondsSinceEpoch);
  showMessage('${formatReminder(at.millisecondsSinceEpoch)} にお知らせします');
}
