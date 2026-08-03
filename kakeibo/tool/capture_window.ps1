# Captures the on-screen pixels of the kakeibo (Flutter Windows app) window by process name
# and saves them as a PNG. Called from integration_test after each screen navigation.
#
# Usage: powershell -File capture_window.ps1 -ProcessName "kakeibo" -OutPath "C:\...\home.png"
param(
    [string]$ProcessName = "kakeibo",
    [Parameter(Mandatory = $true)][string]$OutPath
)

Add-Type -AssemblyName System.Drawing
Add-Type -Name Win32 -Namespace CaptureUtil -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $proc) {
    throw "Process '$ProcessName' with a visible window was not found. Is the kakeibo app running?"
}
$hwnd = $proc.MainWindowHandle

# Restore if minimized and bring to foreground
[CaptureUtil.Win32]::ShowWindow($hwnd, 9) | Out-Null # SW_RESTORE
[CaptureUtil.Win32]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 400 # wait for activation / repaint

$rect = New-Object CaptureUtil.Win32+RECT
[CaptureUtil.Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) {
    throw "Failed to read window size."
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))

$outDir = Split-Path -Parent $OutPath
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "saved: $OutPath"
