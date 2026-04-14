from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi_app.notebook_paths import get_notebook_paths

log = logging.getLogger(__name__)

LEGACY_RESOURCE_DIRS = {
    "documents": "documents",
    "notes": "workspace_items",
    "outputs": "outputs_v2",
}


def _merge_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    if src.is_file():
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        return

    dst.mkdir(parents=True, exist_ok=True)
    for child in src.iterdir():
        target = dst / child.name
        if child.is_dir():
            _merge_tree(child, target)
        elif not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(child, target)


def ensure_workspace_migrated(
    *,
    notebook_id: str,
    notebook_title: str,
    user_id: str,
) -> Path:
    notebook_root = get_notebook_paths(notebook_id, notebook_title, user_id).root
    workspace_root = notebook_root / "workspace"
    marker_path = workspace_root / ".migration_v1.json"

    if marker_path.exists():
        return workspace_root

    workspace_root.mkdir(parents=True, exist_ok=True)
    migrated: Dict[str, str] = {}

    for resource_name, legacy_dir_name in LEGACY_RESOURCE_DIRS.items():
        legacy_path = notebook_root / legacy_dir_name
        target_path = workspace_root / resource_name
        if not legacy_path.exists():
            continue

        try:
            if not target_path.exists():
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(legacy_path), str(target_path))
                migrated[resource_name] = "moved"
            else:
                _merge_tree(legacy_path, target_path)
                migrated[resource_name] = "merged"
            log.info(
                "[workspace_repository] migrated notebook=%s resource=%s legacy=%s target=%s mode=%s",
                notebook_id,
                resource_name,
                legacy_path,
                target_path,
                migrated[resource_name],
            )
        except Exception as exc:
            log.warning(
                "[workspace_repository] migration failed notebook=%s resource=%s legacy=%s target=%s error=%s",
                notebook_id,
                resource_name,
                legacy_path,
                target_path,
                exc,
            )

    marker_payload = {
        "version": 1,
        "migrated_at": datetime.now(timezone.utc).isoformat(),
        "resources": migrated,
    }
    marker_path.write_text(json.dumps(marker_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return workspace_root


class WorkspaceStorageMixin:
    RESOURCE_DIR_NAME = ""
    MANIFEST_FILENAME = "items.json"

    def _workspace_root(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return ensure_workspace_migrated(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
        )

    def _base_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._workspace_root(notebook_id, notebook_title, user_id) / self.RESOURCE_DIR_NAME

    def _manifest_path(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / self.MANIFEST_FILENAME

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _read_manifest(self, path: Path) -> List[Dict[str, Any]]:
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _write_manifest(self, path: Path, data: List[Dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _read_json_payload(self, path: Path, fallback: Any) -> Any:
        if not path.exists():
            return fallback
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return fallback

    def _write_json_payload(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _slugify(self, text: str, fallback: str) -> str:
        import re

        safe = re.sub(r"[^\w\u4e00-\u9fff\-]+", "_", (text or "").strip())
        safe = re.sub(r"_+", "_", safe).strip("_.- ")
        return safe or fallback
