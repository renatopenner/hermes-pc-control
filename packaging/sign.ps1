[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$Pfx = '',
  [string]$PfxPassword = '',
  [string]$Thumbprint = '',
  [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $File)) { throw "arquivo nao encontrado: $File" }

# localiza o signtool no Windows SDK
$signtool = (Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -match 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1).FullName
if (-not $signtool) {
  $cmd = Get-Command signtool -ErrorAction SilentlyContinue
  if ($cmd) { $signtool = $cmd.Source }
}
if (-not $signtool) { throw "signtool.exe nao encontrado. Instale o Windows SDK (Signing Tools)." }
Write-Host "signtool: $signtool"

if ($Pfx) {
  if (-not (Test-Path $Pfx)) { throw "pfx nao encontrado: $Pfx" }
  & $signtool sign /f $Pfx /p $PfxPassword /fd SHA256 /tr $TimestampUrl /td SHA256 $File
} elseif ($Thumbprint) {
  & $signtool sign /sha1 $Thumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $File
} else {
  throw "informe -Pfx <arquivo.pfx> -PfxPassword <senha>  OU  -Thumbprint <thumbprint do certificado no repositorio>"
}
if ($LASTEXITCODE -ne 0) { throw "assinatura falhou (exit $LASTEXITCODE)" }

& $signtool verify /pa /v $File
if ($LASTEXITCODE -ne 0) { throw "verificacao da assinatura falhou (exit $LASTEXITCODE)" }

Write-Host ''
Get-AuthenticodeSignature $File | Format-List Status, SignerCertificate, TimeStamperCertificate
Get-FileHash $File -Algorithm SHA256 | Format-List Algorithm, Hash, Path
