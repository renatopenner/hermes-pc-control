"""pc-control — controle total do PC (segundo plano e primeiro plano).

Registers 13 tools into the ``computer_use`` toolset (so they arrive wherever the
built-in desktop toolset is enabled — no config edit needed), plus a ``/pc``
slash command and a desktop pane with a killswitch.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_DIR = str(Path(__file__).resolve().parent)
if _DIR in sys.path:
    sys.path.remove(_DIR)
sys.path.insert(0, _DIR)

import pctools  # noqa: E402


def _handle_slash(ctx, raw_args: str) -> str:
    parts = (raw_args or "").strip().split()
    verb = parts[0].lower() if parts else "status"
    if verb in {"status", "show", ""}:
        return ctx.dispatch_tool("pc_status", {})
    if verb in {"off", "disable", "stop", "panic"}:
        pctools.save_state({**pctools.load_state(), "enabled": False})
        return json.dumps({"ok": True, "enabled": False,
                           "message": "pc-control desligado (killswitch)"}, ensure_ascii=False)
    if verb in {"on", "enable"}:
        pctools.save_state({**pctools.load_state(), "enabled": True})
        return json.dumps({"ok": True, "enabled": True}, ensure_ascii=False)
    if verb in {"audit", "log"}:
        limit = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 15
        return ctx.dispatch_tool("pc_audit", {"limit": limit})
    return (
        "Uso:\n"
        "  /pc            — estado (sessão, janela em foco, capacidades)\n"
        "  /pc off        — killswitch: bloqueia toda ação do pc-control\n"
        "  /pc on         — religa\n"
        "  /pc audit [n]  — últimas n ações auditadas"
    )


def register(ctx) -> None:
    for name in pctools.HANDLERS:
        ctx.register_tool(
            name=name,
            toolset=pctools.TOOLSET,
            schema=pctools.SCHEMAS[name],
            handler=pctools.make_handler(name),
        )

    try:
        ctx.register_command(
            "pc",
            handler=lambda raw: _handle_slash(ctx, raw),
            description="Controle do PC: status, killswitch e auditoria",
            args_hint="status|off|on|audit",
        )
    except TypeError:
        ctx.register_command("pc", handler=lambda raw: _handle_slash(ctx, raw),
                             description="Controle do PC")

    skill_md = Path(__file__).parent / "skills" / "pc-control" / "SKILL.md"
    if skill_md.is_file():
        try:
            ctx.register_skill("pc-control", skill_md)
        except TypeError:
            try:
                ctx.register_skill("pc-control", str(skill_md))
            except Exception:
                pass
        except Exception:
            pass
