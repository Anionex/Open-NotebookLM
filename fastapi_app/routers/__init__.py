from __future__ import annotations

"""
Router package for FastAPI backend (Notebook / frontend-v2).
"""

import warnings

from . import kb, kb_embedding, files, auth

__all__ = ["kb", "kb_embedding", "files", "auth"]

for _name in ("paper2drawio", "paper2ppt"):
    try:
        module = __import__(f"{__name__}.{_name}", fromlist=[_name])
        globals()[_name] = module
        __all__.append(_name)
    except Exception as exc:
        warnings.warn(f"Skip router {_name}: {exc}")
