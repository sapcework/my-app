import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/utils/passcode_hash.dart';

// パスコードロックの状態管理（Web版 passcodeStore に対応）
// 4桁PINのPBKDF2ハッシュをアプリサポートディレクトリのJSONに保存する
class PasscodeController extends ChangeNotifier {
  static const _maxAttempts = 5; // この回数連続で失敗するとロック
  static const _lockDuration = Duration(seconds: 30);

  File? _file;
  bool _enabled = false;
  String? _saltB64;
  String? _hashB64;
  int _failedAttempts = 0;
  DateTime? _lockedUntil;
  bool _unlocked = false; // このセッションで解錠済みか（永続化しない）

  bool get enabled => _enabled;
  bool get unlocked => _unlocked;
  int get failedAttempts => _failedAttempts;
  int get remainingAttempts => _maxAttempts - _failedAttempts;

  bool get isLocked =>
      _lockedUntil != null && DateTime.now().isBefore(_lockedUntil!);

  int get lockRemainingSeconds => isLocked
      ? _lockedUntil!.difference(DateTime.now()).inMilliseconds ~/ 1000 + 1
      : 0;

  Future<void> load() async {
    final dir = await getApplicationSupportDirectory();
    _file = File('${dir.path}${Platform.pathSeparator}passcode.json');
    if (await _file!.exists()) {
      try {
        final data = jsonDecode(await _file!.readAsString()) as Map<String, dynamic>;
        _enabled = data['enabled'] == true;
        _saltB64 = data['salt'] as String?;
        _hashB64 = data['hash'] as String?;
        _failedAttempts = (data['failedAttempts'] as num?)?.toInt() ?? 0;
        final lockedMs = (data['lockedUntil'] as num?)?.toInt() ?? 0;
        _lockedUntil =
            lockedMs > 0 ? DateTime.fromMillisecondsSinceEpoch(lockedMs) : null;
      } catch (_) {
        _enabled = false; // 壊れた設定ファイルはロック無効として扱う
      }
    }
    if (_enabled && (_saltB64 == null || _hashB64 == null)) _enabled = false;
    notifyListeners();
  }

  Future<void> _save() async {
    if (_file == null) return;
    await _file!.writeAsString(jsonEncode({
      'enabled': _enabled,
      'salt': _saltB64,
      'hash': _hashB64,
      'failedAttempts': _failedAttempts,
      'lockedUntil': _lockedUntil?.millisecondsSinceEpoch ?? 0,
    }));
  }

  Future<void> setPasscode(String pin) async {
    final saltB64 = generateSaltB64();
    final hashB64 = await compute(pbkdf2HashTask, {'pin': pin, 'saltB64': saltB64});
    _saltB64 = saltB64;
    _hashB64 = hashB64;
    _enabled = true;
    _unlocked = true; // 設定した本人はそのまま利用継続できる
    _failedAttempts = 0;
    _lockedUntil = null;
    await _save();
    notifyListeners();
  }

  Future<void> removePasscode() async {
    _enabled = false;
    _saltB64 = null;
    _hashB64 = null;
    _failedAttempts = 0;
    _lockedUntil = null;
    await _save();
    notifyListeners();
  }

  // 検証。ロック中は検証自体を行わずfalseを返す（Web版と同じ挙動）
  Future<bool> verify(String pin) async {
    if (isLocked) return false;
    if (_saltB64 == null || _hashB64 == null) return false;
    final hashB64 = await compute(pbkdf2HashTask, {'pin': pin, 'saltB64': _saltB64!});
    if (constantTimeEquals(hashB64, _hashB64!)) {
      _failedAttempts = 0;
      _lockedUntil = null;
      _unlocked = true;
      await _save();
      notifyListeners();
      return true;
    }
    _failedAttempts++;
    if (_failedAttempts >= _maxAttempts) { // ブルートフォース対策の一時ロック
      _lockedUntil = DateTime.now().add(_lockDuration);
      _failedAttempts = 0;
    }
    await _save();
    notifyListeners();
    return false;
  }
}

final passcodeControllerProvider =
    ChangeNotifierProvider<PasscodeController>((ref) => PasscodeController());
