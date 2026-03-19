from __future__ import annotations

"""
Open-NotebookLM FastAPI package.

This package intentionally avoids importing `main` at module import time.
That keeps submodules such as configuration, adapters, and services usable in
lightweight contexts (tests, embedded adapters, scripts) without triggering the
entire application boot sequence and all optional dependencies.
"""

__all__: list[str] = []
