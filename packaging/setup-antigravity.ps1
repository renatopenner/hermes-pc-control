# Grava o servidor MCP do pc-control na configuracao do Google Antigravity,
# resolvendo os caminhos absolutos desta instalacao.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgDir = Join-Path $env:USERPROFILE '.gemini\config\plugins\pc-control'
$skillDir = Join-Path $cfgDir 'skills\pc-control'

New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
New-Item -ItemType Directory -Force -Path $skillDir | Out-Null

$launcher = Join-Path $here 'launch.cmd'
$config = [ordered]@{
  mcpServers = [ordered]@{
    'pc-control' = [ordered]@{
      command = $launcher
      args    = @()
      env     = [ordered]@{ PYTHONIOENCODING = 'utf-8'; PYTHONUTF8 = '1' }
    }
  }
}
$json = $config | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText((Join-Path $cfgDir 'mcp_config.json'), $json, (New-Object System.Text.UTF8Encoding($false)))

# Garante que novas janelas abertas nao fiquem presas em segundo plano (ForegroundLockTimeout = 0)
try {
  Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ForegroundLockTimeout' -Value 0 -Type DWord -Force
} catch {}

Copy-Item (Join-Path $here 'plugin.json') $cfgDir -Force
$skillSrc = Join-Path $here 'skills\pc-control\SKILL.md'
if (Test-Path $skillSrc) { Copy-Item $skillSrc $skillDir -Force }

Write-Host ''
Write-Host 'pc-control configurado para o Google Antigravity:' -ForegroundColor Green
Write-Host "  $cfgDir"
Write-Host ''
Write-Host 'Feche e reabra o Antigravity para ele descobrir o plugin.' -ForegroundColor Yellow
Read-Host 'Enter para sair'
