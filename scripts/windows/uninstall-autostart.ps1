# install-autostart.ps1 で登録したタスクとファイアウォール規則を削除する（データは消さない）。
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\uninstall-autostart.ps1
$ErrorActionPreference = 'Stop'

foreach ($name in 'KintaiKanri-Server', 'KintaiKanri-Backup') {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "削除: $name"
  }
}

# タスクを止めても node.exe が残ることがあるので、このプロジェクトの next start だけを止める。
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*$root*next*start*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "停止: node.exe (PID $($_.ProcessId))" }

$rules = Get-NetFirewallRule -DisplayName 'KintaiKanri (TCP *' -ErrorAction SilentlyContinue
if ($rules) {
  try {
    $rules | Remove-NetFirewallRule
    Write-Host '削除: ファイアウォール規則'
  } catch {
    Write-Warning 'ファイアウォール規則の削除には管理者権限が必要です。'
  }
}
