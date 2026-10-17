import 'dart:io';

import 'package:fastnote/core/passcode_hash.dart';
import 'package:fastnote/state/json_file.dart';
import 'package:fastnote/state/lock.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeBiometric implements BiometricAuth {
  bool result = true;
  int calls = 0;
  @override
  Future<bool> available() async => true;
  @override
  Future<bool> authenticate() async {
    calls++;
    return result;
  }
}

Future<String> fastHash(String secret, String salt) async => '$salt:$secret'; // テストを速くするための代用

void main() {
  late Directory dir;
  late DateTime now;
  late FakeBiometric bio;

  LockController make() => LockController(JsonFile(File('${dir.path}/lock.json')), biometric: bio, hash: fastHash, now: () => now);

  setUp(() {
    dir = Directory.systemTemp.createTempSync('fastnote_lock');
    now = DateTime(2026, 10, 17, 12);
    bio = FakeBiometric();
  });

  tearDown(() => dir.deleteSync(recursive: true));

  test('PIN を設定すると次回起動時はロックされ、正しい PIN で解除できる', () async {
    final a = make();
    await a.load();
    expect(a.locked, isFalse);
    await a.setSecret(LockType.pin, '123456');
    expect(a.locked, isFalse, reason: '設定した直後は使い続けられる');

    final b = make();
    await b.load();
    expect(b.locked, isTrue);
    expect(b.pinLength, 6);
    expect(await b.verify('000000'), isFalse);
    expect(b.locked, isTrue);
    expect(await b.verify('123456'), isTrue);
    expect(b.locked, isFalse);
  });

  test('5回間違えると30秒は正しい値でも解除できない', () async {
    final l = make();
    await l.load();
    await l.setSecret(LockType.password, 'secret');
    for (var i = 0; i < LockController.maxAttempts; i++) {
      expect(await l.verify('wrong'), isFalse);
    }
    expect(l.inPenalty, isTrue);
    expect(await l.verify('secret'), isFalse);
    now = now.add(const Duration(seconds: 31));
    expect(l.inPenalty, isFalse);
    expect(await l.verify('secret'), isTrue);
  });

  test('一時ロックは再起動しても続く', () async {
    final a = make();
    await a.load();
    await a.setSecret(LockType.pin, '1234');
    for (var i = 0; i < LockController.maxAttempts; i++) {
      await a.verify('0000');
    }
    final b = make();
    await b.load();
    expect(b.inPenalty, isTrue);
  });

  test('バックグラウンドから戻ると設定した時間で再ロックする', () async {
    final l = make();
    await l.load();
    await l.setSecret(LockType.pin, '1234');
    await l.setRelockSeconds(60);
    l.onPaused();
    now = now.add(const Duration(seconds: 30));
    l.onResumed();
    expect(l.locked, isFalse, reason: '60秒未満');
    l.onPaused();
    now = now.add(const Duration(seconds: 60));
    l.onResumed();
    expect(l.locked, isTrue);
  });

  test('ファイル選択・共有シートの間は再ロックしない', () async {
    final l = make();
    await l.load();
    await l.setSecret(LockType.pin, '1234');
    await l.suspendRelock(() async {
      l.onPaused();
      now = now.add(const Duration(minutes: 5));
    });
    l.onResumed();
    expect(l.locked, isFalse);
  });

  test('生体認証は有効にしたときだけ使い、失敗したらロックのまま', () async {
    final l = make();
    await l.load();
    await l.setSecret(LockType.pin, '1234');
    l.onPaused();
    l.onResumed();
    expect(l.locked, isTrue);
    expect(await l.unlockWithBiometric(), isFalse);
    expect(bio.calls, 0, reason: '無効のときは呼ばない');
    await l.setUseBiometric(true);
    bio.result = false;
    expect(await l.unlockWithBiometric(), isFalse);
    expect(l.locked, isTrue);
    bio.result = true;
    expect(await l.unlockWithBiometric(), isTrue);
    expect(l.locked, isFalse);
  });

  test('ロックを外すと生体認証も無効になり、再起動してもロックされない', () async {
    final a = make();
    await a.load();
    await a.setSecret(LockType.pin, '1234');
    await a.setUseBiometric(true);
    await a.disable();
    final b = make();
    await b.load();
    expect(b.enabled, isFalse);
    expect(b.locked, isFalse);
    expect(b.useBiometric, isFalse);
  });

  test('設定ファイルが壊れていたらロックしない（締め出し防止）', () async {
    File('${dir.path}/lock.json').writeAsStringSync('{"type":"pin"}');
    final l = make();
    await l.load();
    expect(l.locked, isFalse);
  });

  test('PBKDF2 は同じ入力で同じ値、ソルトが違えば別の値', () {
    final a = pbkdf2HashTask({'secret': '1234', 'saltB64': 'AAAAAAAAAAAAAAAAAAAAAA=='});
    expect(a, pbkdf2HashTask({'secret': '1234', 'saltB64': 'AAAAAAAAAAAAAAAAAAAAAA=='}));
    expect(a, isNot(pbkdf2HashTask({'secret': '1234', 'saltB64': 'AQAAAAAAAAAAAAAAAAAAAA=='})));
  });
}
