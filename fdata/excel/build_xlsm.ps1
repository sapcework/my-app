# FxFetch.bas から FxFetch.xlsm を組み立てる
# 前提: Excel の「VBA プロジェクト オブジェクト モデルへのアクセスを信頼する」がオン（.bas の取り込みに必要）
param(
    [string]$OutPath = (Join-Path $PSScriptRoot 'FxFetch.xlsm')  # 作成するブック
)
$ErrorActionPreference = 'Stop'
$bas = Join-Path $PSScriptRoot 'FxFetch.bas'  # VBA モジュールのソース（CP932）
$pairs = @('AUDCHF','AUDJPY','AUDNZD','AUDUSD','CADJPY','CHFJPY','CNHJPY','EURAUD','EURCHF','EURGBP','EURJPY','EURUSD','GBPAUD','GBPCHF','GBPJPY','GBPUSD','MXNJPY','NZDCHF','NZDJPY','NZDUSD','TRYJPY','USDCAD','USDCHF','USDJPY','ZARJPY')  # csv/ と同じ25ペア
$substitute = @{ 'CNHJPY' = 'CNYJPY' }  # Yahoo に履歴がないペアの代替

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Add()
    while ($wb.Worksheets.Count -gt 1) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }  # シートを1枚にする
    $ws = $wb.Worksheets.Item(1)
    $ws.Name = '取得'

    $ws.Range('A1').Value2 = '為替CSV作成（Yahoo Finance の1時間足 → NYクローズ区切りの日足）'
    $ws.Range('A1').Font.Bold = $true
    $ws.Range('A1').Font.Size = 13
    $ws.Range('A2').Value2 = '出力フォルダ'
    $ws.Range('A3').Value2 = '本数'
    $ws.Range('B3').Value2 = 200
    $ws.Range('B3').HorizontalAlignment = -4131  # 左寄せ
    $ws.Range('D2').Value2 = '起動時に、このブックと同じ場所の csv フォルダを設定します'
    $ws.Range('D3').Value2 = 'データの確定は日本時間 朝6時（米国冬時間は朝7時）。その1時間後以降の実行が目安'
    $ws.Range('D2:D3').Font.ColorIndex = 16  # 灰色
    $ws.Range('B2').Interior.ColorIndex = 2
    $ws.Range('B2:B3').Borders.LineStyle = 1  # 入力欄に枠線
    $ws.Range('A7').Value2 = 'ペア'
    $ws.Range('B7').Value2 = 'Yahooシンボル'
    $ws.Range('D7').Value2 = '結果'
    $ws.Range('A7:D7').Font.Bold = $true
    $ws.Range('A7:D7').Borders.Item(9).LineStyle = 1  # 見出しの下線

    $r = 8
    foreach ($p in $pairs) {
        $ws.Cells.Item($r, 1).Value2 = $p
        $ws.Cells.Item($r, 2).Value2 = $(if ($substitute.ContainsKey($p)) { $substitute[$p] } else { $p })
        $r++
    }
    $ws.Columns.Item(1).ColumnWidth = 14
    $ws.Columns.Item(2).ColumnWidth = 56
    $ws.Columns.Item(3).ColumnWidth = 10
    $ws.Columns.Item(4).ColumnWidth = 44

    $c2 = $ws.Range('C2')
    $btn = $ws.Buttons().Add($c2.Left + 2, $c2.Top + 1, $c2.Width - 4, $c2.Height - 2)
    $btn.Caption = '参照…'
    $btn.OnAction = 'BrowseFolder'
    $b5 = $ws.Range('B5')
    $btn = $ws.Buttons().Add($b5.Left, $b5.Top - 4, 160, 28)
    $btn.Caption = 'CSVを作成'
    $btn.OnAction = 'CreateCsv'
    $btn.Font.Bold = $true

    try {
        [void]$wb.VBProject.VBComponents.Import($bas)
    } catch {
        throw "VBA モジュールを取り込めませんでした。Excel の［ファイル］→［オプション］→［トラスト センター］→［トラスト センターの設定］→［マクロの設定］で「VBA プロジェクト オブジェクト モデルへのアクセスを信頼する」をオンにしてから再実行してください。"
    }

    if (Test-Path $OutPath) { Remove-Item $OutPath }
    $wb.SaveAs($OutPath, 52)  # 52 = xlOpenXMLWorkbookMacroEnabled
    $wb.Close($false)
    "作成しました: $OutPath"
} finally {
    $xl.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
