import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

// PIN・パスワードのハッシュ化（kakeibo の passcode_hash.dart と同じ PBKDF2-SHA256）

const kPasscodeIterations = 200000; // ブルートフォースを遅くするためのイテレーション回数

String generateSaltB64() {
  final rand = Random.secure();
  return base64Encode(Uint8List.fromList(List.generate(16, (_) => rand.nextInt(256)))); // 16バイトのソルト
}

String pbkdf2HashTask(Map<String, String> args) { // compute() から呼ぶ（重いので別 isolate で実行する）
  final salt = base64Decode(args['saltB64']!);
  return base64Encode(_pbkdf2Sha256(utf8.encode(args['secret']!), salt, kPasscodeIterations, 32));
}

Uint8List _pbkdf2Sha256(List<int> password, List<int> salt, int iterations, int dkLen) {
  final hmac = Hmac(sha256, password);
  final blockCount = (dkLen / 32).ceil(); // SHA-256 の出力は32バイト
  final out = <int>[];
  for (var block = 1; block <= blockCount; block++) {
    var u = hmac.convert([
      ...salt,
      (block >> 24) & 0xff, (block >> 16) & 0xff, (block >> 8) & 0xff, block & 0xff, // INT(block) ビッグエンディアン
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

bool constantTimeEquals(String a, String b) { // タイミング攻撃を避けるための固定時間比較
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return diff == 0;
}
