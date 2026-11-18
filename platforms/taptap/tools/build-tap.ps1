# npm run tap-build remains the shorthand for a fresh TapTap diagnostic build.
param(
  [string]$GameVersion = '1.0.0',
  [string]$CocosExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
)

$ErrorActionPreference = 'Stop'
$releaseId = 'diagnostic-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
& (Join-Path $PSScriptRoot 'build-tap-v2.ps1') -ReleaseId $releaseId -GameVersion $GameVersion -CocosExe $CocosExe -Purpose diagnostic
