# Passando pelo antivirus sem drama

Um instalador de automacao de desktop chama atencao de heuristicas: ele mexe em
janelas, envia teclado/mouse e abre processos. Nao existe truque que "desligue"
essa desconfianca — e tentar isso (obfuscar, empacotar escondido) costuma
*piotar* a deteccao. O caminho honesto e curto:

## 1. Assine o MSI com um certificado de verdade

Certificado autoassinado **nao resolve**: o SmartScreen e os antivirus tratam
qualquer assinante desconhecido como suspeito, e um certificado autoassinado
ainda piora (assinatura nao confiavel). E preciso um certificado de code signing
emitido por CA comercial (OV ou EV — DigiCert, Sectigo, GlobalSign, SSL.com).
Os EV exigem token/HSM; os OV modernos tambem vem em token desde 2023.

Depois de instalar o certificado:

```powershell
# a partir do .pfx exportado
.\sign.ps1 -File ..\dist\pc-control-1.0.0.msi -Pfx C:\certs\meu.pfx -PfxPassword '***'

# ou direto do repositorio de certificados do Windows
.\sign.ps1 -File ..\dist\pc-control-1.0.0.msi -Thumbprint ABC123...
```

O script assina com SHA-256, carimba data/hora (RFC 3161), verifica e imprime o
SHA-256 do MSI.

## 2. Construa reputacao

Um certificado novo comeca com reputacao zero: os primeiros downloads ainda
podem mostrar aviso. O que acelera:

- **Microsoft (SmartScreen / Defender):** envie o arquivo assinado em
  <https://www.microsoft.com/wdsi/filesubmission> (escolha "Software developer"
  para tratar como falso positivo) e registre a reputacao em
  <https://reputationcenter.microsoft.com/>.
- **Kaspersky:** <https://opentip.kaspersky.com/> para veredito e
  <https://support.kaspersky.com/report-false-positive> para envio. Verifique
  tambem se o `opentip` marca o binario como `PDM:Trojan.Win32.Generic` — nesse
  caso o texto de submissao deve explicar que e automacao via UI Automation e
  apontar o codigo-fonte.
- **Outros (ESET, Bitdefender, Avast):** cada um tem formulario de falso
  positivo; mandar o mesmo texto + link do repositorio resolve rapido.

Texto de submissao que funciona: nome do produto, o que ele faz, que e open
source (link), que nao instala driver/servico/autostart, que instala por usuario
em `%LOCALAPPDATA%\hermes\plugins\pc-control`, e a lista de APIs usadas
(`SendInput`, `PostMessage`, `UIAutomation`, `PrintWindow`) — tudo API publica
documentada pela Microsoft.

## 3. O que este pacote ja faz para reduzir falso positivo

| Pratica | Como aparece aqui |
| --- | --- |
| Sem elevacao | `Scope="perUser"`, instala em `%LOCALAPPDATA%`; sem UAC |
| Sem servico/driver | nada e registrado como servico, nenhum driver |
| Sem autostart | nenhum Run key, nenhuma tarefa agendada |
| Sem injecao em processo | so API publica (UIA, Win32 messages, SendInput) |
| Sem obfuscacao | Python e PowerShell em texto puro, legiveis |
| Sem rede | o plugin nao abre socket; o MCP fala por stdio |
| Codigo aberto | repositorio publico, diff auditavel |
| Desinstalacao limpa | MSI padrao (`msiexec /x`) |

## 4. Publique o hash

Junto com cada release, publique o SHA-256 (o `build.ps1` imprime). Assim quem
baixa confere a integridade e o proprio antivirus corporativo pode ser alimentado
com o hash pelo administrador.
