import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:local_auth/local_auth.dart';

import '../core/passcode_hash.dart';
import 'json_file.dart';

enum LockType {
  none('なし'),
  pin('PIN（数字4〜8桁）'),
  password('パスワード');

  final String label;
  const LockType(this.label);
}

abstract class BiometricAuth { // テストで差し替えられるように抽象化する
  Future<bool> available();
  Future<bool> authenticate();
}

class LocalBiometricAuth implements BiometricAuth {
  final _auth = LocalAuthentication();

  @override
  Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported() && (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(localizedReason: 'メモを開くには認証してください', biometricOnly: true);
    } catch (_) {
      return false; // キャンセル・失敗・未登録はすべて「解除しない」
    }
  }
}

typedef HashFn = Future<String> Function(String secret, String saltB64);

Future<String> _pbkdf2(String secret, String saltB64) => compute(pbkdf2HashTask, {'secret': secret, 'saltB64': saltB64});

// ロックの設定とセッション中の施錠状態
class LockController extends ChangeNotifier {
  static const maxAttempts = 5; // この回数連続で失敗すると一時ロック
  static const penalties = [ // 一時ロックの待ち時間。ロックされるたびに延ばして、総当たりに時間がかかるようにする
    Duration(seconds: 30),
    Duration(minutes: 1),
    Duration(minutes: 5),
    Duration(minutes: 15),
    Duration(minutes: 30), // 以後はこれ
  ];
  static const relockChoices = [0, 60, 300]; // バックグラウンドから戻ったときに再ロックするまでの秒数

  final JsonFile _store;
  final BiometricAuth biometric;
  final HashFn _hash;
  final DateTime Function() _now;

  LockController(this._store, {BiometricAuth? biometric, HashFn? hash, DateTime Function()? now})
      : biometric = biometric ?? LocalBiometricAuth(),
        _hash = hash ?? _pbkdf2,
        _now = now ?? DateTime.now;

  LockType _type = LockType.none;
  String? _salt, _hashB64;
  int _pinLength = 0; // PIN は桁数がそろった時点で自動的に照合する
  bool _useBiometric = false;
  int _relockSeconds = 0;
  bool _hideInRecents = true;
  int _failed = 0;
  int _lockouts = 0; // 解除に成功するまでに一時ロックされた回数（再起動しても残す）
  DateTime? _lockedUntil;

  bool _locked = false; // 今ロック画面を出しているか（保存しない）
  DateTime? _pausedAt;
  int _suspend = 0; // ファイル選択・共有シート中はバックグラウンドに回っても再ロックしない

  LockType get type => _type;
  bool get enabled => _type != LockType.none;
  bool get locked => _locked;
  int get pinLength => _pinLength;
  bool get useBiometric => _useBiometric;
  int get relockSeconds => _relockSeconds;
  bool get hideInRecents => _hideInRecents;
  int get remainingAttempts => maxAttempts - _failed;
  static String formatWait(Duration d) { // 「30秒」「5分」「1分30秒」の形
    final m = d.inMinutes, sec = d.inSeconds % 60;
    return m == 0 ? '$sec秒' : (sec == 0 ? '$m分' : '$m分$sec秒');
  }

  Duration get nextPenalty => penalties[_lockouts < penalties.length ? _lockouts : penalties.length - 1]; // 次に一時ロックされたときの待ち時間
  bool get inPenalty => _lockedUntil != null && _now().isBefore(_lockedUntil!);
  int get penaltySeconds => inPenalty ? (_lockedUntil!.difference(_now()).inMilliseconds + 999) ~/ 1000 : 0; // 端数は切り上げ（ちょうど30秒なら30）

  Future<void> load() async {
    final m = await _store.read();
    _type = LockType.values.asNameMap()[m['type']] ?? LockType.none;
    _salt = m['salt'] as String?;
    _hashB64 = m['hash'] as String?;
    _pinLength = (m['pinLength'] as num?)?.toInt() ?? 0;
    _useBiometric = m['biometric'] == true;
    _relockSeconds = (m['relockSeconds'] as num?)?.toInt() ?? 0;
    _hideInRecents = m['hideInRecents'] != false;
    _failed = (m['failed'] as num?)?.toInt() ?? 0;
    _lockouts = (m['lockouts'] as num?)?.toInt() ?? 0;
    final until = (m['lockedUntil'] as num?)?.toInt() ?? 0;
    _lockedUntil = until > 0 ? DateTime.fromMillisecondsSinceEpoch(until) : null;
    if (enabled && (_salt == null || _hashB64 == null)) _type = LockType.none; // 壊れた設定ではロックしない（締め出し防止）
    _locked = enabled;
    notifyListeners();
  }

  Future<void> _save() => _store.write({
        'type': _type.name,
        'salt': _salt,
        'hash': _hashB64,
        'pinLength': _pinLength,
        'biometric': _useBiometric,
        'relockSeconds': _relockSeconds,
        'hideInRecents': _hideInRecents,
        'failed': _failed,
        'lockouts': _lockouts,
        'lockedUntil': _lockedUntil?.millisecondsSinceEpoch ?? 0,
      });

  Future<void> setSecret(LockType type, String secret) async {
    assert(type != LockType.none);
    final salt = generateSaltB64();
    _hashB64 = await _hash(secret, salt);
    _salt = salt;
    _type = type;
    _pinLength = type == LockType.pin ? secret.length : 0;
    _failed = 0;
    _lockouts = 0;
    _lockedUntil = null;
    _locked = false; // 設定した本人はそのまま使い続けられる
    await _save();
    notifyListeners();
  }

  Future<void> disable() async {
    _type = LockType.none;
    _salt = _hashB64 = null;
    _pinLength = 0;
    _useBiometric = false;
    _failed = 0;
    _lockouts = 0;
    _lockedUntil = null;
    _locked = false;
    await _save();
    notifyListeners();
  }

  Future<void> setUseBiometric(bool v) async {
    _useBiometric = v;
    await _save();
    notifyListeners();
  }

  Future<void> setRelockSeconds(int v) async {
    _relockSeconds = v;
    await _save();
    notifyListeners();
  }

  Future<void> setHideInRecents(bool v) async {
    _hideInRecents = v;
    await _save();
    notifyListeners();
  }

  Future<bool> verify(String secret) async { // 一時ロック中は照合自体をしない
    if (!enabled || inPenalty || _salt == null || _hashB64 == null) return false;
    final h = await _hash(secret, _salt!);
    if (constantTimeEquals(h, _hashB64!)) {
      _failed = 0;
      _lockouts = 0;
      _lockedUntil = null;
      _locked = false;
      await _save();
      notifyListeners();
      return true;
    }
    _failed++;
    if (_failed >= maxAttempts) {
      _lockedUntil = _now().add(nextPenalty);
      _lockouts++;
      _failed = 0;
    }
    await _save();
    notifyListeners();
    return false;
  }

  Future<bool> unlockWithBiometric() async {
    if (!enabled || !_useBiometric) return false;
    final ok = await suspendRelock(biometric.authenticate);
    if (ok) {
      _locked = false;
      notifyListeners();
    }
    return ok;
  }

  Future<T> suspendRelock<T>(Future<T> Function() action) async { // 外部の画面を開く間は再ロックしない
    _suspend++;
    try {
      return await action();
    } finally {
      _suspend--;
    }
  }

  void onPaused() {
    if (_suspend == 0 && _pausedAt == null) _pausedAt = _now();
  }

  void onResumed() {
    final at = _pausedAt;
    _pausedAt = null;
    if (!enabled || _locked || at == null) return;
    if (_now().difference(at).inSeconds >= _relockSeconds) {
      _locked = true;
      notifyListeners();
    }
  }
}

final lockProvider = ChangeNotifierProvider<LockController>((ref) => throw UnimplementedError('main で override する'));
