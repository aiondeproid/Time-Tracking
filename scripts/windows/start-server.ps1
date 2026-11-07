# 勤怠管理アプリを本番モードで起動する（タスク スケジューラから呼ばれる想定。手動実行も可）。
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\start-server.ps1 -Port 3000
#
# ログは <プロジェクト>\logs\server.log に追記する。
# アプリが異常終了したときは終了コードを返すので、タスク スケジューラの「再起動」設定が働く。
param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node.exe が見つかりません。Node.js をインストールしてください。' }

$next = Join-Path $root 'node_modules\next\dist\bin\next'
if (-not (Test-Path $next)) { throw 'node_modules がありません。先に npm install を実行してください。' }
if (-not (Test-Path (Join-Path $root '.next\BUILD_ID'))) { throw 'ビルドされていません。先に npm run build を実行してください。' }

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'server.log'

Add-Content -Path $log -Encoding UTF8 -Value "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 起動 (port $Port) ====="

# cmd 経由でリダイレクトする（PowerShell 5.1 のリダイレクトは UTF-16 になるため）。
& cmd.exe /d /c "`"$node`" `"$next`" start -p $Port >> `"$log`" 2>&1"
$code = $LASTEXITCODE

Add-Content -Path $log -Encoding UTF8 -Value "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 終了 (exit $code) ====="
exit $code
