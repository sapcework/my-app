import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart'; // AppLifecycleListener（裏に回した・戻ったの通知）
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/utils/passcode_hash.dart';

// パスコードロックの状態管理（Web版 passcodeStore に対応）
// 4桁PINのPBKDF2ハッシュをアプリサポートディレクトリのJSONに保存する
class PasscodeController extends ChangeNotifier {
  static const _maxAttempts = 5; // この回数連続で失敗するとロック
  static const penalties = [ // 一時ロックの待ち時間。ロックされるたびに延ばし、4桁PINの総当たりに時間がかかるようにする（FastNote と同じ）
    Duration(seconds: 30),
    Duration(minutes: 1),
    Duration(minutes: 5),
    Duration(minutes: 15),
    Duration(minutes: 30), // 以後はこれ
  ];
  static const relockAfter = Duration(minutes: 1); // アプリを裏に回してからこの時間が過ぎて戻ると再ロックする

  PasscodeController({Future<String> Function(String pin, String saltB64)? hasher, DateTime Function()? now})
      : _hasher = hasher ?? ((pin, salt) => compute(pbkdf2HashTask, {'pin': pin, 'saltB64': salt})),
        _now = now ?? DateTime.now {
    _lifecycle = AppLifecycleListener(onHide: () => onHidden(), onShow: () => onShown()); // 裏に回した・戻ったを受け取る
  }

  final Future<String> Function(String pin, String saltB64) _hasher; // テストでは軽い関数に差し替える
  final DateTime Function() _now;
  late final AppLifecycleListener _lifecycle;
  DateTime? _hiddenAt;
  int _lockouts = 0; // 解錠に成功するまでに一時ロックされた回数（再起動しても残す）

  File? _file;
  bool _enabled = false;
  String? _saltB64;
  String? _hashB64;
  int _failedAttempts = 0;
  DateTime? _lockedUntil;
  bool _unlocked = false; // このセッションで解錠済みか（永続化しない）
  bool _unlockedOnce = false; // 起動後に一度でも解錠したか。再ロックは画面の状態を残したまま上に重ねる

  bool get enabled => _enabled;
  bool get unlocked => _unlocked;
  bool get unlockedOnce => _unlockedOnce;
  bool get needsRelock => _enabled && !_unlocked && _unlockedOnce; // 使っている途中で再ロックされた状態
  int get failedAttempts => _failedAttempts;
  int get remainingAttempts => _maxAttempts - _failedAttempts;

  bool get isLocked =>
      _lockedUntil != null && _now().isBefore(_lockedUntil!);

  int get lockRemainingSeconds => isLocked
      ? (_lockedUntil!.difference(_now()).inMilliseconds + 999) ~/ 1000 // 端数は切り上げ
      : 0;

  String get lockRemainingLabel { // 「4分30秒」「25秒」のように残り時間を表す
    final s = lockRemainingSeconds;
    return s >= 60 ? '${s ~/ 60}分${s % 60 == 0 ? '' : '${s % 60}秒'}' : '$s秒';
  }

  Duration get _nextPenalty => penalties[_lockouts < penalties.length ? _lockouts : penalties.length - 1];

  void onHidden() => _hiddenAt = _now();

  void onShown() { // 裏に回していた時間が relockAfter 以上なら再ロックする
    final hiddenAt = _hiddenAt;
    _hiddenAt = null;
    if (!_enabled || !_unlocked || hiddenAt == null) return;
    if (_now().difference(hiddenAt) >= relockAfter) {
      _unlocked = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

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
        _lockouts = (data['lockouts'] as num?)?.toInt() ?? 0;
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
      'lockouts': _lockouts,
      'lockedUntil': _lockedUntil?.millisecondsSinceEpoch ?? 0,
    }));
  }

  Future<void> setPasscode(String pin) async {
    final saltB64 = generateSaltB64();
    final hashB64 = await _hasher(pin, saltB64);
    _saltB64 = saltB64;
    _hashB64 = hashB64;
    _enabled = true;
    _unlocked = true; // 設定した本人はそのまま利用継続できる
    _unlockedOnce = true;
    _failedAttempts = 0;
    _lockouts = 0;
    _lockedUntil = null;
    await _save();
    notifyListeners();
  }

  Future<void> removePasscode() async {
    _enabled = false;
    _saltB64 = null;
    _hashB64 = null;
    _failedAttempts = 0;
    _lockouts = 0;
    _lockedUntil = null;
    await _save();
    notifyListeners();
  }

  // 検証。ロック中は検証自体を行わずfalseを返す（Web版と同じ挙動）
  Future<bool> verify(String pin) async {
    if (isLocked) return false;
    if (_saltB64 == null || _hashB64 == null) return false;
    final hashB64 = await _hasher(pin, _saltB64!);
    if (constantTimeEquals(hashB64, _hashB64!)) {
      _failedAttempts = 0;
      _lockouts = 0;
      _lockedUntil = null;
      _unlocked = true;
      _unlockedOnce = true;
      await _save();
      notifyListeners();
      return true;
    }
    _failedAttempts++;
    if (_failedAttempts >= _maxAttempts) { // ブルートフォース対策の一時ロック。回数を重ねるほど長くする
      _lockedUntil = _now().add(_nextPenalty);
      _lockouts++;
      _failedAttempts = 0;
    }
    await _save();
    notifyListeners();
    return false;
  }
}

final passcodeControllerProvider =
    ChangeNotifierProvider<PasscodeController>((ref) => PasscodeController());
