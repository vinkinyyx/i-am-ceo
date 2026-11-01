# R0-02：TapTap 小游戏包体构建（wechatgame 内联构建 + Tap 转换 + 产物自检）
# 背景：Cocos CLI `--build "configPath=..."` 在本机返回 EXIT=-1 且无日志（单实例/环境问题），
#       故改用「内联参数构建 wechatgame」再调用插件转换器，产物路径与原流程一致。
# 用法：powershell -ExecutionPolicy Bypass -File tools/build-tap.ps1 [-GameVersion 1.0.0]

param(
  [string]$GameVersion = '1.0.0',
  [string]$CocosExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
)

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $root 'evidence\test-v1.1\R0'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Cocos 单实例：驻留进程会导致 CLI 静默失败
$running = Get-Process -Name CocosCreator -ErrorAction SilentlyContinue
if ($running) {
  Write-Warning "检测到 CocosCreator 进程（$($running.Id -join ',')），请先关闭编辑器再重跑，避免单实例锁导致构建静默失败"
}

Write-Host "[1/3] 构建 wechatgame ..."
$wxOut = Join-Path $logDir 'build-wx-repro.log'
$wxErr = Join-Path $logDir 'build-wx-repro.err.log'
# 注意：本机必须用单字符串参数 + Start-Process -Wait，'&' 调用会静默不执行
$wxProc = Start-Process -FilePath $CocosExe -ArgumentList "--project `"$root`" --build `"platform=wechatgame;debug=false;buildPath=build;md5Cache=true;sourceMaps=false`" --nogui" -Wait -PassThru -RedirectStandardOutput $wxOut -RedirectStandardError $wxErr
$wxExit = $wxProc.ExitCode
Write-Host "wechatgame 构建返回码: $wxExit（Cocos 正常退出码可能为 36，以产物时间为准）"

$wxIndex = Join-Path $root 'build\wechatgame\game.json'
if (-not (Test-Path $wxIndex)) { throw "构建失败：未生成 build/wechatgame/game.json，详见 $wxOut / $wxErr" }
Write-Host "wechatgame 产物时间: $((Get-Item $wxIndex).LastWriteTime)"

# 启动画面替换（自有 logo/slogan）
& node (Join-Path $root 'tools\patch-splash.cjs') | Out-Null

Write-Host "[2/3] 转换为 Tap 包 ..."
$cvOut = Join-Path $logDir 'convert-tap-repro.log'
& node (Join-Path $root 'tools\convert-tap.cjs') $GameVersion 2>&1 | Out-File -Encoding utf8 $cvOut
$cvExit = $LASTEXITCODE
if ($cvExit -ne 0) { throw "Tap 转换失败，详见 $cvOut" }
if (-not (Select-String -Path $cvOut -Pattern 'CONVERT_OK' -Quiet)) { throw "转换日志缺少 CONVERT_OK，详见 $cvOut" }

# 转换后再次覆盖启动图，保证 Tap 包内为自有图片
& node (Join-Path $root 'tools\patch-splash.cjs') | Out-Null

Write-Host "[3/3] 产物自检 ..."
$zip = Join-Path $root 'build\TapBuild\game.zip'
$json = Join-Path $root 'build\TapBuild\game\game.json'
if (-not (Test-Path $zip)) { throw "缺少 build/TapBuild/game.zip" }
$item = Get-Item $zip
$sizeMb = [math]::Round($item.Length / 1MB, 2)
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash
$gj = Get-Content $json -Raw | ConvertFrom-Json
$check = @"
package: build/TapBuild/game.zip
size_bytes: $($item.Length)
size_mb: $sizeMb
mtime: $($item.LastWriteTime)
sha256: $sha
deviceOrientation: $($gj.deviceOrientation)
productVersion: $($gj.productVersion)
convertScriptVersion: $($gj.convertScriptVersion)
splash_logo_bytes: $((Get-Item (Join-Path $root 'build\TapBuild\game\logo.png')).Length)
splash_slogan_bytes: $((Get-Item (Join-Path $root 'build\TapBuild\game\slogan.png')).Length)
limit_20mb_ok: $($item.Length -lt 20MB)
"@
$check | Out-File -Encoding utf8 (Join-Path $logDir 'package-check.txt')
Write-Host $check
