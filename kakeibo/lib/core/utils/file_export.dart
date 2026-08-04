import 'dart:io';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

/// 書き出し完了をユーザーに伝える。
///
/// Android/iOS は保存先がアプリ専用の非公開領域（端末のファイルマネージャから見えない）になるため、
/// パスを表示するだけでは取り出せない。共有シートを開いて他アプリに渡せるようにする。
/// デスクトップは Documents 直下に保存され普通に開けるので、従来どおりパスを表示する。
Future<void> notifyExported(
  BuildContext context,
  String path, {
  String label = '出力完了', // デスクトップで表示するSnackBarの文言
  String? subject,
}) async {
  if (Platform.isAndroid || Platform.isIOS) {
    await SharePlus.instance.share(
      ShareParams(files: [XFile(path)], subject: subject),
    );
    return;
  }

  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('$label: $path')),
  );
}
