$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$version = [version]((& $node --version).TrimStart('v'))
if ($version -lt [version]'22.13.0') {
    throw "Node.js 22.13.0 veya üzeri gerekli. Bulunan sürüm: $version"
}

New-Item -ItemType Directory -Path (Join-Path $appRoot 'data') -Force | Out-Null
$log = Join-Path $appRoot 'data\server.log'
Set-Location $appRoot

while ($true) {
    "[$(Get-Date -Format o)] Aven başlatılıyor." | Add-Content -Path $log
    & $node --disable-warning=ExperimentalWarning .\start-aven.js *>> $log
    if ($LASTEXITCODE -eq 98) {
        "[$(Get-Date -Format o)] Aven zaten çalışıyor; yinelenen başlatma durduruldu." | Add-Content -Path $log
        break
    }
    "[$(Get-Date -Format o)] Aven kapandı (kod $LASTEXITCODE); 5 saniye içinde yeniden başlatılacak." | Add-Content -Path $log
    Start-Sleep -Seconds 5
}
