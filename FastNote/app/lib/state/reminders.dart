import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../data/note.dart';

// リマインダーの通知。端末内で予約するだけで、通信はしない
abstract class ReminderScheduler {
  Future<bool> requestPermission(); // 通知の許可を求める（許可されていれば true）
  Future<void> schedule(Note n);
  Future<void> cancel(Note n);
}

class NoReminders implements ReminderScheduler { // テスト用（何もしない）
  const NoReminders();
  @override
  Future<bool> requestPermission() async => true;
  @override
  Future<void> schedule(Note n) async {}
  @override
  Future<void> cancel(Note n) async {}
}

final remindersProvider = Provider<ReminderScheduler>((ref) => const NoReminders());

int reminderNotificationId(String noteId) { // メモの ID から通知 ID を作る（同じメモなら常に同じ値）
  var h = 0x811c9dc5; // FNV-1a 32bit
  for (final c in noteId.codeUnits) {
    h = ((h ^ c) * 0x01000193) & 0xffffffff;
  }
  return h & 0x7fffffff; // Android の通知 ID は正の int
}

class LocalReminders implements ReminderScheduler {
  final _plugin = FlutterLocalNotificationsPlugin();
  final void Function(String noteId) onOpen; // 通知をタップしたときに開くメモ
  bool _exactAsked = false;

  LocalReminders({required this.onOpen});

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> init() async {
    tzdata.initializeTimeZones(); // 予約は UTC の時刻で渡すので、ローカルのタイムゾーン名は不要
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (r) {
        if (r.payload != null) onOpen(r.payload!);
      },
    );
  }

  Future<String?> launchedNoteId() async { // 通知のタップでアプリが起動した場合、そのメモの ID
    final d = await _plugin.getNotificationAppLaunchDetails();
    return d?.didNotificationLaunchApp == true ? d?.notificationResponse?.payload : null;
  }

  @override
  Future<bool> requestPermission() async { // 通知の許可（Android 13 以降）。初めてリマインダーを設定するときに聞く
    final ok = await _android?.requestNotificationsPermission() ?? true;
    if (!_exactAsked && await _android?.canScheduleExactNotifications() == false) {
      _exactAsked = true;
      await _android?.requestExactAlarmsPermission(); // 断られても多少ずれるだけで通知は出る
    }
    return ok;
  }

  @override
  Future<void> schedule(Note n) async {
    final at = n.reminderAt;
    if (at == null || at <= DateTime.now().millisecondsSinceEpoch) return;
    final exact = await _android?.canScheduleExactNotifications() ?? false;
    try {
      await _plugin.zonedSchedule(
        id: reminderNotificationId(n.id),
        title: 'リマインダー',
        body: n.title.isEmpty ? '（空のメモ）' : n.title,
        scheduledDate: tz.TZDateTime.fromMillisecondsSinceEpoch(tz.UTC, at),
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'reminder',
            'リマインダー',
            channelDescription: 'メモに設定したリマインダー',
            importance: Importance.high,
            priority: Priority.high,
            visibility: NotificationVisibility.private, // ロック画面ではメモのタイトルを隠す
          ),
        ),
        androidScheduleMode: exact ? AndroidScheduleMode.exactAllowWhileIdle : AndroidScheduleMode.inexactAllowWhileIdle,
        payload: n.id,
      );
    } catch (e) {
      debugPrint('リマインダーを予約できませんでした: $e');
    }
  }

  @override
  Future<void> cancel(Note n) => _plugin.cancel(id: reminderNotificationId(n.id));
}
