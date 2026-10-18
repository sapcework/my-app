import 'dart:convert';
import 'dart:typed_data';

import 'package:fastnote/data/encrypted_backup.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const plain = '表示順,ID,本文\n1,aaaa,"秘密のメモ\n2行目 😀"\n';
  const fast = 1000; // テストでは鍵の導出を軽くする（本番は backupIterations）

  test('正しいパスワードで元の内容に戻る', () async {
    final enc = await encryptBackup(plain, 'pass1234', iterations: fast);
    expect(looksLikeEncryptedBackup(enc), isTrue);
    expect(await decryptBackup(enc, 'pass1234'), plain);
  });

  test('暗号化したファイルには本文がそのまま含まれない', () async {
    final enc = await encryptBackup(plain, 'pass1234', iterations: fast);
    final asText = latin1.decode(enc);
    expect(asText.contains('aaaa'), isFalse);
    expect(utf8.decode(enc, allowMalformed: true).contains('秘密'), isFalse);
  });

  test('同じ内容・同じパスワードでも毎回違う暗号になる（ソルトとノンスが毎回変わる）', () async {
    final a = await encryptBackup(plain, 'pass1234', iterations: fast);
    final b = await encryptBackup(plain, 'pass1234', iterations: fast);
    expect(a, isNot(b));
  });

  test('パスワードが違えば復元できない', () async {
    final enc = await encryptBackup(plain, 'pass1234', iterations: fast);
    expect(() => decryptBackup(enc, 'pass1235'), throwsA(isA<BackupPasswordException>()));
  });

  test('1バイトでも書き換えられていれば検出する（本文・認証タグ・ヘッダのどこでも）', () async {
    final enc = await encryptBackup(plain, 'pass1234', iterations: fast);
    for (final pos in [enc.length ~/ 2, enc.length - 1, 12]) { // 暗号文の中・認証タグ・ソルト
      final bad = Uint8List.fromList(enc)..[pos] ^= 0x01;
      expect(() => decryptBackup(bad, 'pass1234'), throwsA(isA<BackupPasswordException>()), reason: '位置 $pos');
    }
  });

  test('回数はファイルに記録されたものを使う', () async {
    final enc = await encryptBackup(plain, 'pw', iterations: 2000);
    expect(await decryptBackup(enc, 'pw'), plain);
  });

  test('暗号化バックアップでないファイル・新しい版のファイルは分かるエラーにする', () async {
    expect(looksLikeEncryptedBackup(utf8.encode(plain)), isFalse);
    expect(() => decryptBackup(Uint8List.fromList(utf8.encode('x' * 60)), 'pw'), throwsFormatException);
    final enc = await encryptBackup(plain, 'pw', iterations: fast);
    final newer = Uint8List.fromList(enc)..[4] = 99;
    expect(() => decryptBackup(newer, 'pw'), throwsA(isA<FormatException>().having((e) => e.message, 'message', contains('更新'))));
  });
}
