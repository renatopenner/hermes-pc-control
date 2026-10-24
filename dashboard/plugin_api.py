"""Dashboard/desktop backend for pc-control — mounted at /api/plugins/pc-control/."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

_ROOT = Path(__file__).resolve().parent.parent
_root_str = str(_ROOT)
if _root_str in sys.path:
    sys.path.remove(_root_str)
sys.path.insert(0, _root_str)

import pccore  # noqa: E402
import pctools  # noqa: E402

router = APIRouter()


class StatePatch(BaseModel):
    enabled: bool | None = None
    capability: str | None = None
    granted: bool | None = None
    reset: bool | None = None


@router.get("/state")
async def get_state() -> dict:
    state = pctools.load_state()
    try:
        session = pccore.session_state()
    except Exception as exc:  # never break the pane
        session = {"error": f"{type(exc).__name__}: {exc}"}
    return {
        "ok": True,
        "enabled": state.get("enabled", True),
        "allow": state.get("allow"),
        "capabilities": list(pctools.CAPABILITIES),
        "session": session,
        "audit": (state.get("audit") or [])[-10:],
    }


@router.post("/state")
async def set_state(patch: StatePatch) -> dict:
    state = pctools.load_state()
    if patch.reset:
        state = {**pctools.DEFAULT_STATE, "allow": {c: True for c in pctools.CAPABILITIES}}
    if patch.enabled is not None:
        state["enabled"] = bool(patch.enabled)
    if patch.capability:
        cap = patch.capability.strip().lower()
        if cap in pctools.CAPABILITIES:
            state.setdefault("allow", {})[cap] = bool(patch.granted if patch.granted is not None else True)
    pctools.save_state(state)
    return {"ok": True, "enabled": state.get("enabled"), "allow": state.get("allow")}


@router.get("/audit")
async def audit(limit: int = 40) -> dict:
    state = pctools.load_state()
    items = (state.get("audit") or [])[-max(1, min(int(limit), 200)):]
    return {"ok": True, "count": len(items), "items": items}
