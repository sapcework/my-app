// 書き出しファイル（共有シートに渡す一時ファイル）の名前の決まり。後片付けで同じ判定を使う

const exportPrefix = 'fastnote_'; // 抽出ツールの CSV と同じ名前の形（fastnote_YYYYMMDD_HHMMSS.拡張子）
const exportExtensions = ['csv', 'fnbak'];

bool isExportFileName(String name) => name.startsWith(exportPrefix) && exportExtensions.any((ext) => name.endsWith('.$ext'));
