---
name: pc-control
description: "Use when driving the Windows desktop: background-first, foreground on signal."
version: 1.0.0
author: Renato Penner / Hermes
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [desktop, automation, windows, input, uia]
    category: desktop
---

# pc-control — controle do PC (segundo plano → primeiro plano)

Você tem 17 tools para controlar o Windows inteiro. A regra é **background
primeiro, foreground só quando a resposta mandar**. Toda resposta traz
`mode`/`method` (ou, no `pc_act`, `resolved_by`/`foreground_used`/`verified`):
leia antes de escalar, nunca repita uma ação confirmada.

## Ladder de decisão

**Comece por `pc_act`.** Ele percorre a escada sozinho e diz onde parou — é uma
chamada em vez de quatro tentativas:

```
uia-pattern -> uia-legacy -> uia-select -> uia-child-self -> win32-message -> foreground
```

`pc_act action=click|toggle|type|set|key|read|minimize|maximize|restore|close|move|resize`
com `hwnd` + (`name` | `automation_id` | `type`) + `index`/`contains`.

Leia a resposta: `resolved_by` diz a camada que funcionou, `foreground_used=false`
significa que nada apareceu na tela nem mexeu no cursor, e `verified` diz se o
estado mudou de fato. `verified=false` com `ok=true` = o app aceitou e ignorou;
confirme com `pc_screenshot target=window` antes de declarar sucesso.

Só desça manualmente quando precisar de controle fino:

1. `pc_uia action=dump hwnd=<janela>` — vê a árvore acessível (name, automation_id,
   type, rect, patterns). Prefira elementos com pattern `invoke`/`value`/`toggle`.
2. `pc_uia action=invoke|set_value|toggle|select|expand` com `name` ou `automation_id`.
   Isso é background de verdade: não move o cursor nem rouba foco.
3. `pc_win32 action=command control_id=<id>` quando o app é Win32 clássico e você
   já sabe o id do controle (`pc_elements` mostra) — é o caminho mais curto para
   diálogos `#32770`.
4. Árvore vazia (app sem acessibilidade, canvas, jogo): `pc_input mode=foreground`
   (input real, move o cursor — aceitável só quando o usuário não está no meio de algo).
5. `computer_use` (cua-driver) quando você quiser captura com índice de elemento
   ou já estiver usando aquele vocabulário.

Para **app com interface de automação** (Office, `Shell.Application`, WMI): `pc_com`
— `attach`/`create` pelo ProgID, `members` para descobrir, `invoke`/`get_value`/
`set_value`/`default`. É o único caminho que mexe no modelo do documento em vez de
na tela.

Para **ler o conteúdo** de um campo de outro processo: `pc_uia action=get_value`
(ValuePattern/TextPattern). `GetWindowText` não atravessa processos.
Para **ver**: `pc_screenshot target=window` usa PrintWindow — funciona com a
janela atrás de outras.

## Receitas

```
# abrir e preencher Notepad 11 sem roubar foco
pc_process action=start command=notepad.exe
pc_windows process=notepad            -> hwnd
pc_uia action=dump hwnd=<hwnd> limit=60
pc_uia action=set_value hwnd=<hwnd> type=Document value="texto"
pc_uia action=get_value hwnd=<hwnd> type=Document     # confirma

# botão clássico em segundo plano
pc_uia action=click hwnd=<hwnd> name="Selecionar"     # method=bm-click se não houver Invoke

# janela oculta / atrás de tudo
pc_screenshot target=window hwnd=<hwnd>

# mover janela para o segundo monitor e maximizar
pc_window hwnd=<hwnd> action=move x=2560 y=0 width=1280 height=720
pc_window hwnd=<hwnd> action=maximize
```

## Pitfalls que custam tempo

- **Notepad do Win11 é WinUI**: não tem filho `Edit` Win32 — `pc_elements` volta
  quase vazio. Use `pc_uia` (o `Document` expõe `value`/`text`). Notepad clássico
  (e diálogos `#32770`) respondem a `pc_elements` + `BM_CLICK`/`WM_SETTEXT`.
- **UIA custa ~0,5–1,2 s por chamada** (PowerShell + .NET). Faça `dump` uma vez,
  guarde os `name`/`automation_id` e reuse; não faça dump dentro de loop.
- **`name` é exato por padrão**. Se falhar, a resposta traz `suggestions` — use-as
  ou passe `contains=true`.
- **Botão clássico sem Invoke cai em `win32-bm-click`, que costuma vir com
  `verified=false`** (BM_CLICK não muda nada que `_probe` enxergue). Não é falha:
  confirme o efeito real (campo preenchido, janela fechada) em vez do booleano.
- **`pc_win32` com `control_id` errado é silencioso**: WM_COMMAND de id inexistente
  retorna sucesso e não faz nada. Confirme pela janela/estado, não pelo retorno.
- **`pc_elements` é Win32 puro** (rápido, sem PowerShell) mas não enxerga apps
  XAML/modernos nem conteúdo de navegador.
- **`WM_CHAR`/`WM_SETTEXT` cross-process**: na maioria dos apps modernos não
  inserem nada. Se `pc_input type mode=background` devolver `warning`, escale:
  `pc_uia set_value` ou foreground.
- **Sessão bloqueada** (`pc_status.locked=true`): input não é entregue, ponto.
  Peça para desbloquear; processos/serviços/arquivos continuam funcionando.
- **Não feche janela alheia** com `pc_window action=close` nem use `pc_power`
  sem o usuário ter pedido explicitamente. `shutdown`/`restart` exigem
  `confirm="yes"` e têm `delay_s` (cancele com `action=cancel`).
- **Killswitch**: se `pc_control action=disable` estiver ativo (ou o usuário apertou
  STOP no painel), toda tool devolve erro explicando. Não tente contornar com
  PostMessage manual via terminal — peça para religar.
- **Serviço** `start/stop` exige Hermes elevado; `status` não.

## Auditoria

`pc_audit` (ou `/pc audit`) mostra as últimas ações com resultado. Use depois de
uma sequência longa para conferir o que realmente aconteceu antes de declarar
sucesso.
