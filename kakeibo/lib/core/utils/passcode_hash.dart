import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

// パスコードのハッシュ化ユーティリティ（Web版 src/utils/passcode.ts に対応）
// PBKDF2-SHA256・20万回イテレーションでPINをハッシュ化する

const kPasscodeIterations = 200000; // Web版と同じイテレーション回数

String generateSaltB64() {
  final rand = Random.secure();
  final salt = Uint8List.fromList(List.generate(16, (_) => rand.nextInt(256)));
  return base64Encode(salt);
}

// compute() から呼び出すトップレベル関数（重い処理のためisolateで実行する）
// args: {'pin': String, 'saltB64': String}
String pbkdf2HashTask(Map<String, String> args) {
  final salt = base64Decode(args['saltB64']!);
  final hash = _pbkdf2Sha256(utf8.encode(args['pin']!), salt, kPasscodeIterations, 32);
  return base64Encode(hash);
}

Uint8List _pbkdf2Sha256(List<int> password, List<int> salt, int iterations, int dkLen) {
  final hmac = Hmac(sha256, password);
  final blockCount = (dkLen / 32).ceil(); // SHA-256の出力は32バイト
  final out = <int>[];
  for (var block = 1; block <= blockCount; block++) {
    var u = hmac.convert([
      ...salt,
      (block >> 24) & 0xff, (block >> 16) & 0xff, (block >> 8) & 0xff, block & 0xff, // INT(block) big-endian
    ]).bytes;
    final t = List<int>.of(u);
    for (var i = 1; i < iterations; i++) {
      u = hmac.convert(u).bytes;
      for (var k = 0; k < t.length; k++) {
        t[k] ^= u[k];
      }
    }
    out.addAll(t);
  }
  return Uint8List.fromList(out.sublist(0, dkLen));
}

// タイミング攻撃を避けるための固定時間比較
bool constantTimeEquals(String a, String b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return diff == 0;
}
