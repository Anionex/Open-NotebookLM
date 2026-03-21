# workflow_engine/workflow/__init__.py

import importlib
import logging
from pathlib import Path

from .registry import RuntimeRegistry

log = logging.getLogger(__name__)


_pkg_path = Path(__file__).resolve().parent
for py in _pkg_path.glob("wf_*.py"):
    # DrawIO workflows are already hidden in the frontend.
    if py.stem in ("wf_paper2drawio", "wf_paper2drawio_sam3"):
        continue

    mod_name = f"{__name__}.{py.stem}"
    try:
        importlib.import_module(mod_name)
    except ModuleNotFoundError as exc:
        # Optional workflows should not prevent the API from booting.
        log.warning("Skip workflow %s due to missing optional dependency: %s", py.stem, exc)


def get_workflow(name: str):
    return RuntimeRegistry.get(name)


async def run_workflow(name: str, state):
    factory = get_workflow(name)
    graph_builder = factory()
    graph = graph_builder.build()
    return await graph.ainvoke(state)


list_workflows = RuntimeRegistry.all
