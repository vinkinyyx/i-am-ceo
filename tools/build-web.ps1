# Build the local Cocos Web preview and apply shared startup artwork.
param(
  [string]$CocosExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath $CocosExe -PathType Leaf)) { throw "CocosExe not found: $CocosExe" }

$buildDir = Join-Path $root 'build'
$logDir = Join-Path $buildDir 'logs\web'
$stdoutLog = Join-Path $logDir 'build-web.log'
$stderrLog = Join-Path $logDir 'build-web.err.log'
$resultFile = Join-Path $logDir 'creator-result.json'
$started = Get-Date
& node (Join-Path $PSScriptRoot 'run-cocos-build.cjs') $CocosExe $root "platform=web-mobile;debug=true;buildPath=$buildDir" $stdoutLog $stderrLog $resultFile
if ($LASTEXITCODE -ne 0) { throw "Cocos Web build failed. See $stdoutLog and $stderrLog" }

$index = Join-Path $buildDir 'web-mobile\index.js'
if (-not (Test-Path -LiteralPath $index -PathType Leaf) -or (Get-Item -LiteralPath $index).LastWriteTime -lt $started) {
  throw "Fresh Web entry missing: $index"
}
& node (Join-Path $PSScriptRoot 'patch-splash.cjs') $buildDir
if ($LASTEXITCODE -ne 0) { throw 'Web splash patch failed' }
