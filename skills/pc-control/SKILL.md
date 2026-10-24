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

Você tem 14 tools para controlar o Windows inteiro. A regra é **background
primeiro, foreground só quando a resposta mandar**. Toda resposta traz
`mode`/`method`: leia antes de escalar, nunca repita uma ação confirmada.

## Ladder de decisão

Para **agir em um app** (clicar, digitar, marcar, expandir):

1. `pc_uia action=dump hwnd=<janela>` — vê a árvore acessível (name, automation_id,
   type, rect, patterns). Prefira elementos com pattern `invoke`/`value`/`toggle`.
2. `pc_uia action=invoke|set_value|toggle|select|expand` com `name` ou `automation_id`.
   Isso é background de verdade: não move o cursor nem rouba foco.
3. `pc_uia action=click` quando não souber se há pattern — ele tenta Invoke →
   `BM_CLICK` Win32 → clique em primeiro plano, e diz qual usou (`method`).
4. Se a árvore não existir/estiver vazia (app sem acessibilidade, canvas, jogo):
   `pc_input mode=foreground` (input real, move o cursor — aceitável só quando
   o usuário não está no meio de algo).
5. `computer_use` (cua-driver) quando você quiser captura com índice de elemento
   ou já estiver usando aquele vocabulário.

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
