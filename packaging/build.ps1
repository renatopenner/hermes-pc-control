[CmdletBinding()]
param([string]$Wix = '')

$ErrorActionPreference = 'Stop'
$repo  = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $PSScriptRoot 'stage'
$dist  = Join-Path $repo 'dist'

if (-not $Wix) {
  $cmd = Get-Command wix -ErrorAction SilentlyContinue
  if ($cmd) { $Wix = $cmd.Source }
  else {
    $guess = Join-Path $env:USERPROFILE '.dotnet\tools\wix.exe'
    if (Test-Path $guess) { $Wix = $guess }
  }
}
if (-not $Wix -or -not (Test-Path $Wix)) {
  throw "WiX nao encontrado. Instale com: dotnet tool install --global wix --version 5.*"
}

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path $dist  | Out-Null

$payload = @(
  '__init__.py', 'pccore.py', 'pctools.py', 'uia.ps1', 'com.ps1', 'mcp_server.py',
  'plugin.yaml', 'plugin.json', 'README.md', 'LICENSE',
  'skills\pc-control\SKILL.md', 'desktop\plugin.js',
  'dashboard\plugin_api.py', 'dashboard\manifest.json'
)
foreach ($rel in $payload) {
  $src = Join-Path $repo $rel
  if (-not (Test-Path $src)) { throw "arquivo ausente no repo: $rel" }
  $dst = Join-Path $stage $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  Copy-Item $src $dst -Force
}
foreach ($rel in @('launch.cmd', 'setup-antigravity.ps1', 'setup-antigravity.cmd')) {
  Copy-Item (Join-Path $PSScriptRoot $rel) (Join-Path $stage $rel) -Force
}

$msi = Join-Path $dist 'pc-control-1.0.0.msi'
# WiX resolves relative Source= paths against the working directory
Push-Location $PSScriptRoot
try {
  & $Wix build 'pc-control.wxs' -o $msi -arch x64
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($code -ne 0) { throw "wix build falhou (exit $code)" }
if ($LASTEXITCODE -ne 0) { throw "wix build falhou (exit $LASTEXITCODE)" }

Write-Host ''
Write-Host "MSI gerado: $msi" -ForegroundColor Green
Get-FileHash $msi -Algorithm SHA256 | Format-List Algorithm, Hash, Path
