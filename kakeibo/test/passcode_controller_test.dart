import 'package:flutter_test/flutter_test.dart';
import 'package:kakeibo/presentation/providers/passcode_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized(); // AppLifecycleListener のため

  late DateTime now;
  late PasscodeController c;

  setUp(() async {
    now = DateTime(2026, 10, 25, 12);
    c = PasscodeController(hasher: (pin, salt) async => '$salt:$pin', now: () => now); // 重いPBKDF2の代わりに軽い関数を使う
    await c.setPasscode('1234');
  });
  tearDown(() => c.dispose());

  Future<void> failFiveTimes() async {
    for (var i = 0; i < 5; i++) {
      expect(await c.verify('0000'), isFalse);
    }
  }

  test('正しいPINで解錠、違うPINでは解錠しない', () async {
    expect(await c.verify('9999'), isFalse);
    expect(c.remainingAttempts, 4);
    expect(await c.verify('1234'), isTrue);
    expect(c.unlocked, isTrue);
    expect(c.remainingAttempts, 5);
  });

  test('5回続けて間違えると一時ロックし、回数を重ねるほど待ち時間が延びる', () async {
    final expected = [30, 60, 300, 900, 1800, 1800]; // 秒。5回目以降は30分のまま
    for (final seconds in expected) {
      await failFiveTimes();
      expect(c.isLocked, isTrue);
      expect(c.lockRemainingSeconds, seconds);
      expect(await c.verify('1234'), isFalse, reason: 'ロック中は正しいPINでも解錠しない');
      now = now.add(Duration(seconds: seconds));
      expect(c.isLocked, isFalse);
    }
  });

  test('解錠に成功すると待ち時間の段階が最初に戻る', () async {
    await failFiveTimes();
    now = now.add(const Duration(seconds: 30));
    await failFiveTimes();
    expect(c.lockRemainingSeconds, 60);
    now = now.add(const Duration(minutes: 1));
    expect(await c.verify('1234'), isTrue);
    await failFiveTimes();
    expect(c.lockRemainingSeconds, 30);
  });

  test('残り時間の表示', () async {
    await failFiveTimes();
    expect(c.lockRemainingLabel, '30秒');
    now = now.add(const Duration(seconds: 30));
    await failFiveTimes(); // 2回目は1分
    now = now.add(const Duration(minutes: 1));
    await failFiveTimes(); // 3回目は5分
    expect(c.lockRemainingLabel, '5分');
    now = now.add(const Duration(seconds: 30));
    expect(c.lockRemainingLabel, '4分30秒');
  });

  test('裏に回して1分以上たって戻ると再ロックする。1分未満ならしない', () async {
    expect(c.unlocked, isTrue);
    c.onHidden();
    now = now.add(const Duration(seconds: 59));
    c.onShown();
    expect(c.unlocked, isTrue);
    expect(c.needsRelock, isFalse);

    c.onHidden();
    now = now.add(PasscodeController.relockAfter);
    c.onShown();
    expect(c.unlocked, isFalse);
    expect(c.needsRelock, isTrue, reason: '使っている途中の再ロックとして扱う');
    expect(await c.verify('1234'), isTrue);
    expect(c.needsRelock, isFalse);
  });

  test('パスコードを解除したら再ロックしない', () async {
    await c.removePasscode();
    c.onHidden();
    now = now.add(const Duration(hours: 1));
    c.onShown();
    expect(c.needsRelock, isFalse);
    expect(c.enabled, isFalse);
  });
}
