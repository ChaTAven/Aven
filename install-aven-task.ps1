$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType S4U -RunLevel Highest
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\run-aven.ps1`"" `
    -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName 'Aven' `
    -Description 'Aven Node.js uygulamasını sunucu başlangıcında çalıştırır.' `
    -Principal $principal `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force | Out-Null

Start-ScheduledTask -TaskName 'Aven'
Write-Host 'Aven görevi oluşturuldu ve başlatıldı. Günlük: data\server.log'
