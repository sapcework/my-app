import 'dart:convert';
import 'dart:io';

// 設定類を JSON ファイル1つに保存する小さな入れ物（アプリ専用領域に置く）
class JsonFile {
  final File file;
  JsonFile(this.file);

  Future<Map<String, dynamic>> read() async {
    try {
      if (!await file.exists()) return {};
      final v = jsonDecode(await file.readAsString());
      return v is Map<String, dynamic> ? v : {};
    } catch (_) {
      return {}; // 壊れていたら初期値で起動する
    }
  }

  Future<void> write(Map<String, dynamic> data) async {
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString(jsonEncode(data), flush: true);
    await tmp.rename(file.path); // 書き込み途中で落ちても壊れないように置き換える
  }
}
