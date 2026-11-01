# Rebuild web-mobile via Cocos CLI (Start-Process single-string args), then patch splash.
# Usage: powershell -ExecutionPolicy Bypass -File tools/build-web.ps1
param(
  [string]$CocosExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
)

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $root 'evidence\test-v1.1\R0'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$running = Get-Process -Name CocosCreator -ErrorAction SilentlyContinue
if ($running) {
  Write-Warning "CocosCreator process detected ($($running.Id -join ',')); single-instance lock may make CLI build fail silently"
}

$out = Join-Path $logDir 'build-web.log'
$err = Join-Path $logDir 'build-web.err.log'
Write-Host "[1/2] build web-mobile ..."
$proc = Start-Process -FilePath $CocosExe -ArgumentList "--project `"$root`" --build `"platform=web-mobile;debug=true;buildPath=build`" --nogui" -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
Write-Host "exit=$($proc.ExitCode) (36 means ok, check artifact mtime)"

$index = Join-Path $root 'build\web-mobile\index.js'
if (-not (Test-Path $index)) { throw "build failed: build/web-mobile/index.js missing, see $out / $err" }
Write-Host "web-mobile index.js mtime: $((Get-Item $index).LastWriteTime)"

Write-Host "[2/2] patch splash ..."
& node (Join-Path $root 'tools\patch-splash.cjs')
