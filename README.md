# pc-control

**Background-first control of Windows for AI agents.** Hermes Agent plugin *and*
a standalone MCP server, so the same engine drives the Hermes desktop app and any
MCP client (Google Antigravity, Claude, Codex, ...) — without a second codebase.

17 tools. Cursor stays still, focus stays yours, and every action reports which
layer actually did the work.

```
        pc_act  (automatic ladder)
           |
   UIA pattern  ->  UIA legacy  ->  UIA select  ->  UIA self  ->  Win32 message  ->  foreground
   (background)     (background)    (background)   (background)      (background)      (moves cursor)
           |
     resolved_by + foreground_used + verified  <-- no guessing what happened
```

## Why a ladder instead of one technique

Nothing covers everything on Windows. Classic Win32 dialogs honour
`PostMessage`/`BM_CLICK`; WinUI 3, WPF, Electron and UWP mostly ignore it and want
UI Automation; a few apps only respond to real `SendInput` with focus. So `pc_act`
walks the cheap invisible options first and escalates only when it must, returning
`resolved_by` (`uia-pattern`, `uia-value`, `win32-bm-click`, `foreground-click`, ...),
`foreground_used` and `verified` every time.

| Layer | Mechanism | Steals focus | Works with |
|---|---|---|---|
| **UIA** — `pc_uia`, `pc_act` | IUIAutomation via .NET/PowerShell: Invoke, Value.SetValue, Toggle, SelectionItem, ExpandCollapse, RangeValue, Transform, Scroll | no | most apps: Win32, WinUI/XAML (Notepad 11), WPF, UWP, Electron/Chromium with a11y on |
| **Win32 messages** — `pc_win32`, `pc_input mode=background` | `PostMessage` WM_CHAR/WM_KEYDOWN/WM_SETTEXT/BM_CLICK, `WM_COMMAND` | no | classic Win32 dialogs: charmap, msconfig, installers, Delphi/VB6, some Java |
| **SendInput** — `pc_input mode=foreground` | real OS input | **yes** (cursor + focus) | everything, always |
| **COM** — `pc_com` | `ProgID` automation: attach/create, members, invoke, get/set | no | Office, WMI wrappers, `Shell.Application`, anything with automation interface |
| **cua-driver** — `computer_use` | AX tree + element click | no | already in Hermes; use when you also want screenshot + element index |

## Tools

| Tool | What it does |
|---|---|
| `pc_status` | interactive/locked session, focus, monitors, DPI, elevation, killswitch state |
| `pc_control` | killswitch (`enable`/`disable`), `grant`/`revoke` per capability, `audit`, `reset` |
| `pc_windows` | list windows: hwnd, title, class, PID, process, rect, focus |
| `pc_window` | `focus` `minimize` `maximize` `restore` `close` `topmost` `move` `resize` |
| `pc_elements` | **Win32 control tree** (fast): hwnd, class, text, id, editable, clickable |
| `pc_uia` | **accessibility tree** + act: `dump` `find` `invoke` `set_value` `get_value` `click` `toggle` `select` `expand` `focus` |
| `pc_act` | **the ladder**: `click` `toggle` `type` `set` `key` `read` `minimize` `maximize` `restore` `close` `move` `resize`, auto-escalating |
| `pc_win32` | raw messages: `command` (WM_COMMAND by control id), `click`, `char`, `key`, `settext` |
| `pc_com` | COM automation by ProgID: `attach` `create` `members` `invoke` `get_value` `set_value` `default` |
| `pc_input` | `click` `double_click` `right_click` `move` `drag` `scroll` `type` `key` `hotkey` `press_button` `wait` in `mode=auto\|background\|foreground` |
| `pc_settext` | `WM_SETTEXT` into a control (classic Win32) |
| `pc_screenshot` | screen, monitor or **hidden window** (PrintWindow) → PNG |
| `pc_clipboard` | read/write the clipboard |
| `pc_process` | `list` `start` `stop` `kill` (optional tree) |
| `pc_service` | `status` `start` `stop` `restart` via sc.exe (start/stop need elevation) |
| `pc_power` | `lock` `sleep` `hibernate` `restart` `shutdown` `cancel` — destructive ones require `confirm="yes"` and `delay_s` |
| `pc_audit` | recent actions with result |

Session commands in Hermes: `/pc` (status), `/pc off` (panic), `/pc on`, `/pc audit [n]`.

## Install (Hermes desktop)

**Option A — MSI** (recommended for other machines):

```powershell
msiexec /i pc-control-1.0.0.msi
```

Per-user install, no UAC: drops the plugin into
`%LOCALAPPDATA%\hermes\plugins\pc-control`, adds a Start-menu shortcut that wires
the MCP server into Google Antigravity. Hermes picks it up on next start.

**Option B — manual**: copy this folder to `%LOCALAPPDATA%\hermes\plugins\pc-control`
and restart Hermes (Python tools load at process start). The desktop panel shows
up on the right-hand zone; without restarting, ⌘K → *Reload desktop plugins*.

Tools join the `computer_use` toolset — available in any session where desktop
control is already enabled, no `config.yaml` edit needed.

## Install (Google Antigravity, via MCP)

Run the shortcut the MSI created, or:

```powershell
.\setup-antigravity.cmd
```

It writes `%USERPROFILE%\.gemini\config\plugins\pc-control\mcp_config.json`
pointing at `launch.cmd` (which finds Python 3 by itself), copies the manifest and
the skill. Close and reopen Antigravity to discover the plugin.

Any other MCP client: point it at `launch.cmd` (stdio), env
`PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`.

## Killswitch

State in `%LOCALAPPDATA%\hermes\plugin-data\pc-control\state.json`:

```json
{ "enabled": true,
  "allow": {"input":true,"foreground":true,"background":true,"window":true,"elements":true,
            "process":true,"service":true,"power":true,"screenshot":true,"clipboard":true,
            "com":true,"messages":true},
  "audit": [ ... last 100 actions ... ] }
```

- `pc_control action=disable` (or `/pc off`, or the panel's **STOP** button) blocks
  everything immediately — every handler checks state before acting.
- `revoke` turns off a single capability (e.g. `background`, `power`).
- Every action is audited: who, what, when, result.

## Real limits (not bugs)

1. **Locked session (Win+L)**: the secure desktop delivers no input. `pc_status.locked=true`.
   Nothing GUI works until unlock — only process/service/files.
2. **Session 0** (service/SSH): no interactive desktop, same story.
3. **UAC / secure desktop**: no agent clicks the elevation prompt.
4. **Anti-cheat / DirectInput games**: ignore synthetic input, even foreground.
5. **Reading text from another process**: `GetWindowText`/`WM_GETTEXT` don't cross
   processes → use `pc_uia action=get_value` (ValuePattern/TextPattern).
6. **`pc_settext` cross-process**: WM_SETTEXT is not marshalled; may hit the window
   title instead. Prefer `pc_uia set_value` when ValuePattern exists.
7. **Chromium/Electron**: `PostMessage` is usually ignored; UIA and foreground work.
8. **Service start/stop, `pc_power`**: need Hermes running elevated.

## Security model

- No elevation, no service, no driver, no autostart, no injection into other
  processes, no network socket. Only documented public API: UI Automation,
  Win32 messages, `SendInput`, `PrintWindow`, COM.
- The killswitch is checked in-process on every handler; audit trail is local.
- The agent refuses password/2FA/payment entry and never dumps OS or browser
  credentials — that boundary is not configurable.

## Build the MSI

```powershell
dotnet tool install --global wix --version 5.*   # once
.\packaging\build.ps1
```

Produces `dist\pc-control-1.0.0.msi` plus its SHA-256. To sign it with a real
code-signing certificate (needed to keep SmartScreen/AV quiet):

```powershell
.\packaging\sign.ps1 -File .\dist\pc-control-1.0.0.msi -Pfx C:\certs\you.pfx -PfxPassword '***'
```

See [`packaging/WHITELIST.md`](packaging/WHITELIST.md) for the AV false-positive
playbook (why self-signed certs don't help, how to submit to Microsoft/Kaspersky,
what this package already does to stay under the radar).

## Verify

```bash
hermes plugins doctor pc-control    # runtime contracts
hermes plugins list | grep pc-control
```

## License

MIT — see [LICENSE](LICENSE).
