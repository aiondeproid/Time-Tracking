# 勤怠管理アプリの自動起動と毎日のバックアップを Windows のタスク スケジューラに登録する。
#
# 管理者として PowerShell を開き、プロジェクトのフォルダで:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
#
# オプション:
#   -Port 3000          待ち受けポート
#   -BackupTime 03:00   毎日のバックアップ時刻（PC が起動している時間にすること）
#   -RunAs System       System = PC 起動時に誰もログインしていなくても起動（管理者権限が必要・推奨）
#                       User   = このユーザーがログインしたときに起動（管理者権限なしでも登録できる）
#
# 登録されるもの:
#   タスク「KintaiKanri-Server」 … 起動時にアプリを開始。異常終了したら 1 分後に再起動（最大 999 回）
#   タスク「KintaiKanri-Backup」 … 毎日 BackupTime に npm run backup 相当を実行
#   ファイアウォール規則「KintaiKanri (TCP <Port>)」 … ドメイン/プライベート ネットワークからの受信を許可
#
# 取り消すときは uninstall-autostart.ps1 を実行する。
param(
  [int]$Port = 3000,
  [string]$BackupTime = '03:00',
  [ValidateSet('System', 'User')]
  [string]$RunAs = 'System'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if ($RunAs -eq 'System' -and -not $isAdmin) {
  throw '-RunAs System には管理者権限が必要です。PowerShell を「管理者として実行」で開き直すか、-RunAs User を指定してください。'
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node.exe が見つかりません。Node.js をインストールしてください。' }
if (-not (Test-Path (Join-Path $root '.next\BUILD_ID'))) {
  throw 'ビルドされていません。先に npm install と npm run build を実行してください。'
}
if (-not (Test-Path (Join-Path $root '.env.local'))) {
  Write-Warning '.env.local がありません（SIGNUP_CODE 未設定のため新規登録は無効になります）。'
}

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$startScript = Join-Path $root 'scripts\windows\start-server.ps1'
$backupScript = Join-Path $root 'scripts\backup-db.mjs'

if ($RunAs -eq 'System') {
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $serverTrigger = New-ScheduledTaskTrigger -AtStartup
} else {
  $me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
  $serverTrigger = New-ScheduledTaskTrigger -AtLogOn -User $me
}

# --- アプリ本体 ---------------------------------------------------------------
$serverAction = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $root `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`" -Port $Port"
$serverSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'KintaiKanri-Server' -Force `
  -Description '勤怠管理アプリ（Next.js）を起動する' `
  -Action $serverAction -Trigger $serverTrigger -Principal $principal -Settings $serverSettings | Out-Null
Write-Host "登録: KintaiKanri-Server（$RunAs / port $Port）"

# --- 毎日のバックアップ -------------------------------------------------------
$backupAction = New-ScheduledTaskAction -Execute $node -WorkingDirectory $root -Argument "`"$backupScript`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At $BackupTime
$backupSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'KintaiKanri-Backup' -Force `
  -Description '勤怠管理アプリの DB を毎日バックアップする' `
  -Action $backupAction -Trigger $backupTrigger -Principal $principal -Settings $backupSettings | Out-Null
Write-Host "登録: KintaiKanri-Backup（毎日 $BackupTime）"

# --- ファイアウォール -------------------------------------------------------
$ruleName = "KintaiKanri (TCP $Port)"
if ($isAdmin) {
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port `
    -Action Allow -Profile Domain, Private | Out-Null
  Write-Host "登録: ファイアウォール規則 $ruleName（ドメイン / プライベート）"
} else {
  Write-Warning "管理者権限がないためファイアウォール規則は登録していません。他の PC から開けない場合は情シスに TCP $Port の受信許可を依頼してください。"
}

# --- 今すぐ起動 ---------------------------------------------------------------
Start-ScheduledTask -TaskName 'KintaiKanri-Server'
Write-Host ''
Write-Host "起動しました。数秒後に http://localhost:$Port を開いて確認してください。"
Write-Host "他の PC からは http://$($env:COMPUTERNAME):$Port （または この PC の IP アドレス）で開けます。"
Write-Host "ログ: $(Join-Path $root 'logs\server.log')"
