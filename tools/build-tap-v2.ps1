# R19/R20/R21：TapTap 小游戏发布流水线（独立工作目录 + 统一补丁 + 最终包校验）
# 用法：
#   powershell -ExecutionPolicy Bypass -File tools/build-tap-v2.ps1 `
#     -ReleaseId m3-20261102-a -GameVersion 1.0.0 [-SkipBuild]
# 纪律：关键步骤失败即 $PSCmdlet.ThrowTerminatingError；每 attempt 使用独立目录，
#       绝不原地覆盖既有 game.zip；补丁只从本次构建产物读取实际 hash。

param(
  [Parameter(Mandatory = $true)][string]$ReleaseId,
  [string]$GameVersion = '1.0.0',
  [string]$CocosExe = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe',
  [switch]$SkipBuild,
  [string]$Attempt = '01',
  [ValidateSet('diagnostic', 'product-test-candidate')][string]$Purpose = 'diagnostic'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
function Fail($msg) { throw $msg }
$safeSegment = '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
if ($ReleaseId -notmatch $safeSegment -or $Attempt -notmatch $safeSegment) { Fail 'ReleaseId/Attempt 仅允许 1-64 位 ASCII 字母、数字、点、下划线、短横线，且首字符须为字母或数字' }
if ($GameVersion -notmatch '^\d+\.\d+\.\d+$') { Fail "GameVersion 必须是整数三段版本 x.y.z：$GameVersion" }
$releaseRoot = Join-Path $root 'build\release'
$workRoot = Join-Path $releaseRoot "$ReleaseId\$Attempt"
$wxDir = Join-Path $workRoot 'wechatgame'
$tapDir = Join-Path $workRoot 'tap'
$zipOut = Join-Path $workRoot 'game.zip'
$logRoot = Join-Path $root 'evidence\m3\build'
$logDir = Join-Path $logRoot "$ReleaseId\$Attempt"
foreach ($candidate in @($workRoot, $logDir)) {
  $resolved = [IO.Path]::GetFullPath($candidate)
  if ($candidate -eq $workRoot) { $basePath = $releaseRoot } else { $basePath = $logRoot }
  $base = [IO.Path]::GetFullPath($basePath)
  if (-not $resolved.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { Fail "输出路径越界：$resolved" }
}
if ((Test-Path $workRoot) -or (Test-Path $logDir)) { Fail "Release attempt 已存在，禁止覆盖：$ReleaseId/$Attempt" }
New-Item -ItemType Directory -Force -Path $workRoot, $logDir, $wxDir, $tapDir | Out-Null

# Freeze the dirty release inputs; evidence/output changes are outside the fingerprint.
& node (Join-Path $root 'tools\fingerprint-release-inputs.cjs') $root (Join-Path $logDir 'release-inputs-before.json')
if ($LASTEXITCODE -ne 0) { Fail '构建前输入指纹失败' }

function Run-Node($script, [string[]]$argList) {
  $all = @($script) + $argList
  $logFileName = [IO.Path]::GetFileNameWithoutExtension([string]$script) + '.log'
  $stepLog = Join-Path $logDir $logFileName
  $stepErr = Join-Path $logDir ([IO.Path]::GetFileNameWithoutExtension([string]$script) + '.err.log')
  $stepResult = Join-Path $logDir ([IO.Path]::GetFileNameWithoutExtension([string]$script) + '.result.json')
  & node (Join-Path $root 'tools\run-node-step.cjs') $stepLog $stepErr $stepResult @($all)
  if ($LASTEXITCODE -ne 0) { Fail "node $script 失败，日志：$stepLog / $stepErr" }
  $result = Get-Content -LiteralPath $stepResult -Raw | ConvertFrom-Json
  if ($result.exitCode -ne 0) { Fail "node $script 退出码 $($result.exitCode)，日志：$stepLog / $stepErr" }
}

# 0) 前置：Cocos 单实例锁与路径
if (-not $SkipBuild) {
  $runningForProject = Get-CimInstance Win32_Process -Filter "name='CocosCreator.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$root*" }
  if ($runningForProject) { Fail '检测到本项目正在 Cocos Creator 中打开；请先关闭该项目编辑器' }
  if (-not (Test-Path $CocosExe)) { Fail "CocosExe 不存在：$CocosExe" }
}

# 1) wechatgame 构建到本次独立目录
if (-not $SkipBuild) {
  Write-Host "[1/5] Cocos 构建 wechatgame -> $wxDir"
  $buildArg = "platform=wechatgame;debug=false;buildPath=$wxDir;md5Cache=true;sourceMaps=false"
  $buildStarted = Get-Date
  $buildLog = Join-Path $logDir 'cocos-build.log'
  $buildErr = Join-Path $logDir 'cocos-build.err.log'
  # Use Creator's documented CLI shape (`--project <path> --build <options>`).
  # The runner captures complete stdout/stderr and the actual Creator exit code.
  & node (Join-Path $root 'tools\run-cocos-build.cjs') $CocosExe $root $buildArg $buildLog $buildErr (Join-Path $logDir 'creator-result.json')
  if ($LASTEXITCODE -ne 0) { Fail "Cocos CLI/build marker validation failed; inspect $buildLog / $buildErr" }
  $creatorResult = Get-Content -LiteralPath (Join-Path $logDir 'creator-result.json') -Raw | ConvertFrom-Json
  $buildExitCode = [int]$creatorResult.exitCode
  # Creator 3.8.8 on this host returns 36 for a successful CLI build; local
  # build-web evidence also records the matching "Build Task Finished" marker.
  if (($buildExitCode -ne 0) -and ($buildExitCode -ne 36)) { Fail "Cocos CLI 失败，退出码 $buildExitCode，日志：$buildLog / $buildErr" }
  $buildLogText = Get-Content -LiteralPath $buildLog -Raw
  $buildDoneMarker = 'build Task (wechatgame) Finished in'
  $hasBuildDoneMarker = $buildLogText.Contains($buildDoneMarker)
  if (-not $hasBuildDoneMarker) { Fail "Cocos 构建日志缺少 wechatgame 完成标志：$buildLog" }
  $builtGameJsonFiles = @(Get-ChildItem -LiteralPath $wxDir -Filter 'game.json' -File -Recurse | Where-Object { $_.LastWriteTime -ge $buildStarted })
  if ($builtGameJsonFiles.Count -ne 1) { Fail "本次 Cocos 构建应产生且只产生一个新的 game.json，实际 $($builtGameJsonFiles.Count) 个" }
  $wxDir = $builtGameJsonFiles[0].Directory.FullName
  Write-Host "本次 Cocos 实际输出：$wxDir"
} else {
  if ($Purpose -eq 'product-test-candidate') { Fail 'product-test-candidate 禁止 -SkipBuild' }
  Write-Host '[1/5] -SkipBuild：复用现有 build/wechatgame（仅流水线联调）'
  if (-not (Test-Path (Join-Path $root 'build\wechatgame\game.json'))) { Fail 'SkipBuild 但 build/wechatgame/game.json 不存在' }
  Copy-Item -Recurse -Force (Join-Path $root 'build\wechatgame\*') $wxDir
}

# 2) 转换为 Tap 包（输出到本次 tap 目录）
Write-Host '[2/5] Tap 转换'
Run-Node (Join-Path $root 'tools\convert-tap-v2.cjs') @($GameVersion, $wxDir, $tapDir)
if (-not (Select-String -Path (Join-Path $logDir 'convert-tap-v2.log') -Pattern 'CONVERT_OK' -Quiet)) { Fail '转换日志缺少 CONVERT_OK' }
$tapGameDir = Join-Path $tapDir 'game'
if (-not (Test-Path (Join-Path $tapGameDir 'game.json'))) { Fail "转换产物缺少 game/game.json：$tapGameDir" }

# 3) 统一补丁（首屏 + 启动诊断/帧调度注入 + fetch 兼容），按实际文件 hash 命中
Write-Host '[3/5] 统一补丁与诊断注入'
Run-Node (Join-Path $root 'tools\patch-release.cjs') @($tapGameDir, $ReleaseId, $GameVersion)
if (-not (Select-String -Path (Join-Path $logDir 'patch-release.log') -Pattern 'PATCH_OK' -Quiet)) { Fail '补丁日志缺少 PATCH_OK' }

# 4) 单一打包器（archiver，正斜杠条目）
Write-Host '[4/5] 打包'
Run-Node (Join-Path $root 'tools\repack-release.cjs') @($tapGameDir, $zipOut)
if (-not (Select-String -Path (Join-Path $logDir 'repack-release.log') -Pattern 'REPACK_OK' -Quiet)) { Fail '打包日志缺少 REPACK_OK' }
if (-not (Test-Path $zipOut) -or (Get-Item -LiteralPath $zipOut).Length -le 0) { Fail 'REPACK_OK 后 ZIP 不存在或为空' }

# 5) 最终 zip 校验 + manifest
Write-Host '[5/5] 包校验与 manifest'
Run-Node (Join-Path $root 'tools\verify-package.cjs') @($zipOut, $ReleaseId, $GameVersion, $logDir)
if (-not (Select-String -Path (Join-Path $logDir 'verify-package.log') -Pattern 'VERIFY_OK' -Quiet)) { Fail '校验日志缺少 VERIFY_OK' }
if ($SkipBuild) { $buildExitCode = 'not-run' } else { $buildExitCode = [string]$buildExitCode }
Run-Node (Join-Path $root 'tools\enrich-manifest.cjs') @($root, $logDir, $ReleaseId, $Attempt, $Purpose, $buildExitCode)
if (-not (Select-String -Path (Join-Path $logDir 'enrich-manifest.log') -Pattern 'MANIFEST_ENRICHED' -Quiet)) { Fail 'manifest 日志缺少 MANIFEST_ENRICHED' }

$manifest = Join-Path $logDir 'manifest.json'
if (-not (Test-Path $manifest)) { Fail '未生成 manifest.json' }

& node (Join-Path $root 'tools\fingerprint-release-inputs.cjs') $root (Join-Path $logDir 'release-inputs-after.json')
if ($LASTEXITCODE -ne 0) { Fail '构建后输入指纹失败' }
$before = (Get-Content -LiteralPath (Join-Path $logDir 'release-inputs-before.json') -Raw | ConvertFrom-Json).fingerprint
$after = (Get-Content -LiteralPath (Join-Path $logDir 'release-inputs-after.json') -Raw | ConvertFrom-Json).fingerprint
if ($before -ne $after) { Fail '构建期间源码/资源/工具输入变化；本 attempt 作废，不得作为候选' }
$manifestData = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
$manifestData | Add-Member -Force -NotePropertyName sourceFingerprint -NotePropertyValue $after
[IO.File]::WriteAllText($manifest, (ConvertTo-Json -InputObject $manifestData -Depth 30) + "`n", [Text.UTF8Encoding]::new($false))
Write-Host "PIPELINE_OK $ReleaseId $zipOut"
