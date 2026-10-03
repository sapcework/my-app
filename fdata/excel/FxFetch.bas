Attribute VB_Name = "FxFetch"
'為替の日足CSVを作成する（fdata/fetch_latest.py の移植）
'Yahoo Finance の1時間足を取得し、NYクローズ（NY時間17:00）区切りの日足に組み立てて、ヘッダなしの「日付,始値,高値,安値,終値」で書き出す
Option Explicit

Private Type SYSTEMTIME
    wYear As Integer
    wMonth As Integer
    wDayOfWeek As Integer
    wDay As Integer
    wHour As Integer
    wMinute As Integer
    wSecond As Integer
    wMilliseconds As Integer
End Type
Private Declare PtrSafe Sub GetSystemTime Lib "kernel32" (lpSystemTime As SYSTEMTIME)
Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)

Private Const SHEET_NAME As String = "取得" '設定シートの名前
Private Const ROW_FIRST As Long = 8 'ペア一覧の先頭行
Private Const DAYS_BACK As Long = 330 '取得する暦日数（1時間足は730日前まで）
Private Const MIN_BARS As Long = 12 '1日の1時間足がこれ未満なら休場日として除く
Private Const UA As String = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" 'User-Agent なしだと Yahoo が拒否する
Private Const EPOCH As Date = #1/1/1970# 'Unix 時刻の起点

Private quietMode As Boolean 'True ならメッセージを表示せず lastMessage に残す
Private lastMessage As String '最後の結果メッセージ

'===== ボタンから呼ぶマクロ =====

Public Function CreateCsvQuiet(Optional ByVal outDir As String = "") As String '画面に何も出さずに実行し、結果のメッセージを返す（自動実行用）
    quietMode = True: lastMessage = ""
    If outDir <> "" Then ThisWorkbook.Worksheets(SHEET_NAME).Range("B2").Value = outDir
    CreateCsv
    quietMode = False
    CreateCsvQuiet = lastMessage
End Function

Private Sub Notify(ByVal msg As String, ByVal style As VbMsgBoxStyle)
    lastMessage = msg
    If Not quietMode Then MsgBox msg, style
End Sub

Public Sub CreateCsv()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    Dim outDir As String: outDir = Trim$(CStr(ws.Range("B2").Value)) '出力フォルダ
    If outDir = "" Then outDir = DefaultFolder() '空ならブックと同じ場所の csv フォルダ
    Dim nRows As Long: nRows = Val(ws.Range("B3").Value) '出力する本数
    If nRows <= 0 Then nRows = 200

    Dim last As Long: last = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row 'ペア一覧の最終行
    If last < ROW_FIRST Then Notify "A" & ROW_FIRST & " から下にペアを入力してください。", vbExclamation: Exit Sub
    ws.Range(ws.Cells(ROW_FIRST, 4), ws.Cells(ws.Rows.Count, 4)).ClearContents '前回の結果を消す

    Dim names As New Collection, datas As New Collection, failed As Long, r As Long
    Dim todayNum As Long: todayNum = TradeDayNum(UnixNow()) '進行中の営業日（未確定）
    For r = ROW_FIRST To last
        Dim pair As String: pair = UCase$(Trim$(CStr(ws.Cells(r, 1).Value)))
        If pair <> "" Then
            Dim sym As String: sym = UCase$(Trim$(CStr(ws.Cells(r, 2).Value))) 'Yahoo のシンボル
            If sym = "" Then sym = pair
            Application.StatusBar = "取得中: " & sym & "（" & (r - ROW_FIRST + 1) & "/" & (last - ROW_FIRST + 1) & "）"
            ws.Cells(r, 4).Value = "取得中…"
            DoEvents
            Dim daily As Object, msg As String
            msg = TryBuild(sym, todayNum, daily) '成功なら空文字
            If msg = "" Then
                names.Add sym: datas.Add daily
                ws.Cells(r, 4).Value = "取得 " & daily.Count & "日分"
            Else
                failed = failed + 1
                ws.Cells(r, 4).Value = "エラー: " & msg
            End If
            Sleep 500 '連続アクセスを控える
        End If
    Next r
    Application.StatusBar = False

    If failed > 0 Then Notify failed & " ペアの取得に失敗したため、CSVは作成していません。D列のエラーを確認してください。", vbCritical: Exit Sub
    If names.Count = 0 Then Notify "ペアがありません。", vbExclamation: Exit Sub

    Dim dates() As Long, nDates As Long
    nDates = CommonDates(datas, nRows, dates) '全ペアで日付をそろえる（元データと同じ）
    If nDates < nRows Then Notify "全ペアに共通する日付が " & nDates & " 日しかありません（必要 " & nRows & " 日）。", vbCritical: Exit Sub

    On Error GoTo WriteFailed
    EnsureFolder outDir
    Dim i As Long
    For i = 1 To names.Count
        WriteCsv outDir & "\" & names(i) & ".csv", datas(i), dates, Right$(names(i), 3) = "JPY"
    Next i
    On Error GoTo 0

    Dim d0 As String, d1 As String
    d0 = Format$(EPOCH + dates(0), "yyyy\/mm\/dd"): d1 = Format$(EPOCH + dates(nRows - 1), "yyyy\/mm\/dd")
    For r = ROW_FIRST To last
        If Left$(CStr(ws.Cells(r, 4).Value), 2) = "取得" Then ws.Cells(r, 4).Value = d0 & " ～ " & d1 & "  " & nRows & "行"
    Next r
    Notify names.Count & " ペアのCSVを作成しました。" & vbLf & d0 & " ～ " & d1 & "（" & nRows & "営業日）" & vbLf & outDir, vbInformation
    Exit Sub
WriteFailed:
    Application.StatusBar = False
    Notify "CSVを書き込めませんでした: " & Err.Description & vbLf & outDir, vbCritical
End Sub

Public Sub Auto_Open() 'ブックを開いたときに Excel が自動で実行する
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    On Error GoTo Failed
    If LCase$(Left$(ThisWorkbook.Path, 4)) = "http" Then Err.Raise vbObjectError + 4, , "OneDrive などのクラウド上のブックです" 'URL の場所にはフォルダを作れない
    EnsureFolder DefaultFolder()
    ws.Range("B2").Value = DefaultFolder() '出力先をカレントフォルダの csv にする
    ws.Range("D2").Value = "起動時に、このブックと同じ場所の csv フォルダを設定しています"
    ThisWorkbook.Saved = True 'これだけで「保存しますか」と聞かれないようにする
    Exit Sub
Failed:
    ws.Range("D2").Value = "csv フォルダを作れませんでした（" & Err.Description & "）。［参照…］で出力先を選んでください"
    ThisWorkbook.Saved = True
End Sub

Private Function DefaultFolder() As String
    DefaultFolder = ThisWorkbook.Path & "\csv" 'ブックと同じ場所の csv フォルダ
End Function

Public Sub BrowseFolder()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    With Application.FileDialog(4) 'msoFileDialogFolderPicker
        .Title = "CSVの出力フォルダを選択"
        If .Show = -1 Then ws.Range("B2").Value = .SelectedItems(1)
    End With
End Sub

'===== 取得と日足の組み立て =====

Private Function TryBuild(ByVal sym As String, ByVal todayNum As Long, ByRef daily As Object) As String
    On Error GoTo Failed
    Set daily = BuildDaily(FetchJson(sym), todayNum)
    If daily.Count = 0 Then Err.Raise vbObjectError + 2, , "データがありません"
    Exit Function
Failed:
    TryBuild = Err.Description
End Function

Private Function FetchJson(ByVal sym As String) As String
    Dim now_ As Double: now_ = UnixNow()
    Dim url As String
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" & sym & "=X?period1=" & Format$(now_ - DAYS_BACK * 86400#, "0") & "&period2=" & Format$(now_, "0") & "&interval=1h"
    Dim http As Object: Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", url, False
    http.SetRequestHeader "User-Agent", UA
    http.SetTimeouts 10000, 10000, 30000, 60000 '名前解決・接続・送信・受信（ミリ秒）
    http.Send
    If http.Status <> 200 Then Err.Raise vbObjectError + 1, , "HTTP " & http.Status & "（シンボルが正しいか確認してください）"
    FetchJson = http.ResponseText
End Function

Private Function BuildDaily(ByVal json As String, ByVal todayNum As Long) As Object
    Dim ts As Variant, o As Variant, h As Variant, l As Variant, c As Variant
    ts = GetArray(json, "timestamp"): o = GetArray(json, "open"): h = GetArray(json, "high"): l = GetArray(json, "low"): c = GetArray(json, "close")
    Dim days As Object: Set days = CreateObject("Scripting.Dictionary") '営業日番号 → (本数, 始値, 高値, 安値, 終値)
    Dim i As Long, k As Long, a As Variant
    For i = 0 To UBound(ts)
        If o(i) <> "null" And h(i) <> "null" And l(i) <> "null" And c(i) <> "null" Then '値のない時間帯を除く
            k = TradeDayNum(Val(ts(i)))
            If days.Exists(k) Then
                a = days(k)
                a(0) = a(0) + 1
                If Val(h(i)) > a(2) Then a(2) = Val(h(i))
                If Val(l(i)) < a(3) Then a(3) = Val(l(i))
                a(4) = Val(c(i)) '足は時刻順に並んでいるので最後の足が終値
                days(k) = a
            Else
                days.Add k, Array(1, Val(o(i)), Val(h(i)), Val(l(i)), Val(c(i)))
            End If
        End If
    Next i
    Dim result As Object: Set result = CreateObject("Scripting.Dictionary")
    Dim key As Variant
    For Each key In days.Keys
        a = days(key)
        If key < todayNum And Weekday(EPOCH + key, vbMonday) <= 5 And a(0) >= MIN_BARS Then '未確定日・週末・休場日を除く
            result.Add key, Array(a(1), a(2), a(3), a(4))
        End If
    Next key
    Set BuildDaily = result
End Function

Private Function GetArray(ByVal json As String, ByVal key As String) As Variant
    Dim p As Long: p = InStr(1, json, """" & key & """:[")
    If p = 0 Then Err.Raise vbObjectError + 3, , "データがありません（" & key & "）"
    p = p + Len(key) + 4 '「"key":[」の直後
    Dim q As Long: q = InStr(p, json, "]")
    GetArray = Split(Mid$(json, p, q - p), ",")
End Function

'===== 日付（NY 17:00 区切り） =====

Private Function UnixNow() As Double
    Dim st As SYSTEMTIME: GetSystemTime st
    Dim u As Date: u = DateSerial(st.wYear, st.wMonth, st.wDay) + TimeSerial(st.wHour, st.wMinute, st.wSecond)
    UnixNow = Round((u - EPOCH) * 86400#, 0)
End Function

Private Function NyOffsetSec(ByVal unixTs As Double) As Double 'NY の UTC オフセット（米国夏時間を自前計算）
    Dim y As Integer: y = Year(EPOCH + Int(unixTs / 86400#))
    Dim d As Integer, s1 As Double, s2 As Double
    For d = 8 To 14 '3月第2日曜
        If Weekday(DateSerial(y, 3, d)) = vbSunday Then s1 = (DateSerial(y, 3, d) - EPOCH) * 86400# + 7 * 3600#: Exit For '2:00 EST = 7:00 UTC
    Next d
    For d = 1 To 7 '11月第1日曜
        If Weekday(DateSerial(y, 11, d)) = vbSunday Then s2 = (DateSerial(y, 11, d) - EPOCH) * 86400# + 6 * 3600#: Exit For '2:00 EDT = 6:00 UTC
    Next d
    If unixTs >= s1 And unixTs < s2 Then NyOffsetSec = -4 * 3600# Else NyOffsetSec = -5 * 3600#
End Function

Private Function TradeDayNum(ByVal unixTs As Double) As Long 'NY 17:00 以降は翌営業日扱い。1970/1/1 からの日数で返す
    TradeDayNum = Int((unixTs + NyOffsetSec(unixTs) + 7 * 3600#) / 86400#)
End Function

'===== 日付をそろえて書き出す =====

Private Function CommonDates(ByVal datas As Collection, ByVal nRows As Long, ByRef dates() As Long) As Long
    Dim all() As Long, n As Long, key As Variant, i As Long, j As Long, ok As Boolean
    ReDim all(0 To datas(1).Count - 1)
    For Each key In datas(1).Keys
        ok = True
        For i = 2 To datas.Count
            If Not datas(i).Exists(key) Then ok = False: Exit For
        Next i
        If ok Then all(n) = key: n = n + 1
    Next key
    For i = 1 To n - 1 '挿入ソート（数百件なので十分）
        Dim v As Long: v = all(i): j = i - 1
        Do While j >= 0
            If all(j) <= v Then Exit Do
            all(j + 1) = all(j): j = j - 1
        Loop
        all(j + 1) = v
    Next i
    CommonDates = n
    If n < nRows Then Exit Function
    ReDim dates(0 To nRows - 1)
    For i = 0 To nRows - 1: dates(i) = all(n - nRows + i): Next i '直近 nRows 日
End Function

Private Sub WriteCsv(ByVal path As String, ByVal daily As Object, ByRef dates() As Long, ByVal isJpy As Boolean)
    Dim fmt As String: If isJpy Then fmt = "0.000" Else fmt = "0.00000" '元データの桁数に合わせる
    Dim dec As String: dec = Mid$(CStr(1.5), 2, 1) 'Windows の小数点記号
    Dim f As Integer: f = FreeFile
    Dim i As Long, k As Long, a As Variant, s As String
    Open path For Output As #f
    For i = 0 To UBound(dates)
        a = daily(dates(i))
        s = Format$(EPOCH + dates(i), "yyyy\/mm\/dd")
        For k = 0 To 3: s = s & "," & Replace(Format$(a(k), fmt), dec, "."): Next k
        Print #f, s & vbLf; 'LF 改行（元データと同じ）
    Next i
    Close #f
End Sub

Private Sub EnsureFolder(ByVal p As String) '途中のフォルダもまとめて作る
    If Len(Dir$(p, vbDirectory)) > 0 Then Exit Sub
    Dim parent As String: parent = Left$(p, InStrRev(p, "\") - 1)
    If Len(parent) > 2 Then EnsureFolder parent
    MkDir p
End Sub
