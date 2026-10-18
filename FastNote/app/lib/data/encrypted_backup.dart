import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';

import '../core/passcode_hash.dart';

// パスワード付きの暗号化バックアップ（.fnbak）。中身はこのアプリの CSV（フォルダ・☆なども含む全情報）。
// メモ帳や Excel で開いても読めないようにするためのもので、復元にはパスワードが要る。
//
// ファイルの並び（数値はビッグエンディアン）:
//   "FNBK"(4) | 版(1) | PBKDF2 の回数(4) | ソルト(16) | ノンス(12) | 暗号文 | 認証タグ(16)
// 鍵は PBKDF2-HMAC-SHA256(パスワード, ソルト, 回数) で作る。暗号は AES-256-GCM で、
// 先頭のヘッダ（ノンスまで）も認証の対象にしているので、ヘッダを書き換えても検出できる

const backupExtension = 'fnbak';
const backupIterations = 300000; // 1〜2秒かかる程度（パスワードの総当たりを遅くする）
const minBackupPasswordLength = 8; // ファイルを手に入れた人に総当たりされにくい長さ（取り込み時は問わない）

const _magic = [0x46, 0x4E, 0x42, 0x4B]; // "FNBK"
const _version = 1;
const _saltLength = 16, _nonceLength = 12, _macLength = 16;
const _headerLength = 4 + 1 + 4 + _saltLength + _nonceLength;

class BackupPasswordException implements Exception { // パスワードが違う、またはファイルが壊れている
  const BackupPasswordException();
  @override
  String toString() => 'パスワードが違うか、ファイルが壊れています';
}

bool looksLikeEncryptedBackup(List<int> bytes) =>
    bytes.length >= _headerLength + _macLength && [for (var i = 0; i < 4; i++) bytes[i]].join(',') == _magic.join(',');

Future<Uint8List> encryptBackup(String plain, String password, {int iterations = backupIterations}) =>
    compute(_encryptTask, (plain: plain, password: password, iterations: iterations)); // 鍵の導出が重いので別 isolate で

Future<String> decryptBackup(Uint8List data, String password) => compute(_decryptTask, (data: data, password: password));

Future<Uint8List> _encryptTask(({String plain, String password, int iterations}) a) async {
  final rand = Random.secure();
  List<int> randomBytes(int n) => List.generate(n, (_) => rand.nextInt(256));
  final salt = randomBytes(_saltLength), nonce = randomBytes(_nonceLength);
  final header = BytesBuilder()
    ..add(_magic)
    ..addByte(_version)
    ..add((ByteData(4)..setUint32(0, a.iterations)).buffer.asUint8List())
    ..add(salt)
    ..add(nonce);
  final headerBytes = header.toBytes();
  final box = await AesGcm.with256bits().encrypt(
    utf8.encode(a.plain),
    secretKey: SecretKey(pbkdf2Sha256(utf8.encode(a.password), salt, a.iterations, 32)),
    nonce: nonce,
    aad: headerBytes,
  );
  return (BytesBuilder()
        ..add(headerBytes)
        ..add(box.cipherText)
        ..add(box.mac.bytes))
      .toBytes();
}

Future<String> _decryptTask(({Uint8List data, String password}) a) async {
  final d = a.data;
  if (!looksLikeEncryptedBackup(d)) throw const FormatException('FastNote の暗号化バックアップではありません');
  if (d[4] != _version) throw const FormatException('新しい版の FastNote で作られたバックアップです。アプリを更新してください');
  final iterations = ByteData.sublistView(d, 5, 9).getUint32(0);
  if (iterations < 1000 || iterations > 10000000) throw const BackupPasswordException(); // 壊れたヘッダで極端に時間がかからないように
  final salt = d.sublist(9, 9 + _saltLength);
  final nonce = d.sublist(9 + _saltLength, _headerLength);
  try {
    final clear = await AesGcm.with256bits().decrypt(
      SecretBox(d.sublist(_headerLength, d.length - _macLength), nonce: nonce, mac: Mac(d.sublist(d.length - _macLength))),
      secretKey: SecretKey(pbkdf2Sha256(utf8.encode(a.password), salt, iterations, 32)),
      aad: d.sublist(0, _headerLength),
    );
    return utf8.decode(clear);
  } on SecretBoxAuthenticationError {
    throw const BackupPasswordException();
  }
}
