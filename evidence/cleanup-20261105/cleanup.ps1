$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if (Get-Process -Name CocosCreator -ErrorAction SilentlyContinue) { throw 'Close Creator first' }
& python (Join-Path $PSScriptRoot 'inventory.py') prepare
if ($LASTEXITCODE -ne 0) { throw 'Inventory failed' }
$pointer = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'archive-location.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$archive = [IO.Path]::GetFullPath($pointer.archive)
$manifest = Get-Content -LiteralPath (Join-Path $archive 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.root -ne $root) { throw 'Workspace mismatch' }
foreach ($record in $manifest.targets) {
  $source = (Resolve-Path -LiteralPath $record.source).Path
  $destination = [IO.Path]::GetFullPath($record.destination)
  if (-not $source.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Source outside workspace' }
  if (-not $destination.StartsWith($archive + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination outside archive' }
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Move-Item -LiteralPath $source -Destination $destination
}
& python (Join-Path $PSScriptRoot 'inventory.py') verify
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }
