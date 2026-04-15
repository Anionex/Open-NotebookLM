from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException

from fastapi_app.notebook_paths import get_notebook_paths


class ThinkFlowWorkspaceService:
    SUPPORTED_TYPES = {"summary", "guidance"}
    DEFAULT_TITLES = {
        "summary": "对话摘要",
        "guidance": "产出指导",
    }

    def _base_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        """Return the workspace items directory, preferring workspace/notes/ if it exists.

        The workspace migration may have moved ``workspace_items/`` into
        ``workspace/notes/``.  We check the migrated location first so
        that previously-created workspace items remain accessible.
        """
        notebook_root = get_notebook_paths(notebook_id, notebook_title, user_id).root
        workspace_dir = notebook_root / "workspace" / "notes"
        if workspace_dir.exists():
            return workspace_dir
        return notebook_root / "workspace_items"

    def _manifest_path(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / "items.json"

    def _current_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / "current"

    def _item_path(self, notebook_id: str, notebook_title: str, user_id: str, item_id: str) -> Path:
        return self._current_dir(notebook_id, notebook_title, user_id) / f"{item_id}.json"

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

    def _read_item_payload(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _write_item_payload(self, path: Path, payload: Dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _slugify(self, text: str, fallback: str) -> str:
        safe = re.sub(r"[^\w\u4e00-\u9fff\-]+", "_", (text or "").strip())
        safe = re.sub(r"_+", "_", safe).strip("_.- ")
        return safe or fallback

    def _find_item(self, manifest: List[Dict[str, Any]], item_id: str) -> tuple[int, Dict[str, Any]]:
        for index, item in enumerate(manifest):
            if item.get("id") == item_id:
                return index, item
        raise HTTPException(status_code=404, detail="Workspace item not found")

    def _merge_source_refs(
        self,
        existing: List[Dict[str, Any]],
        incoming: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for item in [*(existing or []), *(incoming or [])]:
            if not isinstance(item, dict):
                continue
            key = json.dumps(item, ensure_ascii=False, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
        return merged

    def _compose_capture_block(
        self,
        *,
        item_type: str,
        title: str,
        text_items: List[str],
        source_refs: List[Dict[str, Any]],
        prompt: str = "",
    ) -> str:
        safe_title = self._slugify(title or self.DEFAULT_TITLES.get(item_type, "工作区条目"), self.DEFAULT_TITLES.get(item_type, "工作区条目"))
        lines: List[str] = [f"## {safe_title}", ""]

        if source_refs:
            ref_names = [str(item.get("name") or item.get("title") or item.get("source") or "").strip() for item in source_refs]
            ref_names = [item for item in ref_names if item]
            if ref_names:
                lines.append(f"> 来源: {' / '.join(ref_names[:8])}")
                lines.append("")

        cleaned_prompt = str(prompt or "").strip()
        if item_type == "summary":
            if cleaned_prompt:
                lines.append(f"> 摘要要求: {cleaned_prompt}")
                lines.append("")
            lines.append("### 对话沉淀")
            lines.append("")
        else:
            if cleaned_prompt:
                lines.append("### 产出要求")
                lines.append("")
                lines.append(cleaned_prompt)
                lines.append("")
            lines.append("### 参考对话")
            lines.append("")

        for item in text_items:
            cleaned = str(item or "").strip()
            if not cleaned:
                continue
            lines.append(cleaned)
            lines.append("")

        return "\n".join(lines).strip()

    def _public_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item: Dict[str, Any],
        include_content: bool = False,
    ) -> Dict[str, Any]:
        payload = self._read_item_payload(self._item_path(notebook_id, notebook_title, user_id, item["id"]))
        content = str(payload.get("content") or "") if include_content else ""
        source_refs = payload.get("source_refs") if include_content else item.get("source_refs") or []
        return {
            **item,
            "content": content,
            "source_refs": source_refs if isinstance(source_refs, list) else [],
            "capture_count": int(item.get("capture_count") or 0),
        }

    def list_items(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        manifest = self._read_manifest(self._manifest_path(notebook_id, notebook_title, user_id))
        if item_type:
            manifest = [item for item in manifest if item.get("type") == item_type]
        items = [
            self._public_item(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                item=item,
                include_content=False,
            )
            for item in manifest
        ]
        return sorted(items, key=lambda item: str(item.get("updated_at") or ""), reverse=True)

    def create_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_type: str,
        title: str,
        content: str = "",
        source_refs: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        if item_type not in self.SUPPORTED_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported workspace item type")
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        now = self._now()
        item = {
            "id": f"ws_{uuid4().hex[:12]}",
            "type": item_type,
            "title": (title or "").strip() or self.DEFAULT_TITLES[item_type],
            "created_at": now,
            "updated_at": now,
            "capture_count": 0,
            "source_refs": source_refs or [],
        }
        payload = {
            "content": content or "",
            "source_refs": source_refs or [],
        }
        self._write_item_payload(self._item_path(notebook_id, notebook_title, user_id, item["id"]), payload)
        manifest.append(item)
        self._write_manifest(manifest_path, manifest)
        return self._public_item(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            item=item,
            include_content=True,
        )

    def get_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_id: str,
    ) -> Dict[str, Any]:
        manifest = self._read_manifest(self._manifest_path(notebook_id, notebook_title, user_id))
        _, item = self._find_item(manifest, item_id)
        return self._public_item(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            item=item,
            include_content=True,
        )

    def update_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
    ) -> Dict[str, Any]:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, item = self._find_item(manifest, item_id)
        payload_path = self._item_path(notebook_id, notebook_title, user_id, item_id)
        payload = self._read_item_payload(payload_path)
        if title is not None:
            item["title"] = (title or "").strip() or self.DEFAULT_TITLES.get(item.get("type") or "", "工作区条目")
        if content is not None:
            payload["content"] = content
        item["updated_at"] = self._now()
        self._write_item_payload(payload_path, payload)
        manifest[index] = item
        self._write_manifest(manifest_path, manifest)
        return self._public_item(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            item=item,
            include_content=True,
        )

    def delete_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_id: str,
    ) -> None:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, _item = self._find_item(manifest, item_id)
        manifest.pop(index)
        self._write_manifest(manifest_path, manifest)

        payload_path = self._item_path(notebook_id, notebook_title, user_id, item_id)
        if payload_path.exists():
            payload_path.unlink()

    def capture_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        item_type: str,
        title: str,
        text_items: List[str],
        source_refs: Optional[List[Dict[str, Any]]] = None,
        prompt: str = "",
        item_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if item_type not in self.SUPPORTED_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported workspace item type")
        cleaned_items = [str(item or "").strip() for item in text_items if str(item or "").strip()]
        if not cleaned_items:
            raise HTTPException(status_code=400, detail="No content to capture")
        incoming_refs = source_refs or []
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)

        if not item_id:
            created = self.create_item(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                item_type=item_type,
                title=title,
                content="",
                source_refs=incoming_refs,
            )
            item_id = created["id"]
            manifest = self._read_manifest(manifest_path)

        index, item = self._find_item(manifest, item_id)
        if item.get("type") != item_type:
            raise HTTPException(status_code=400, detail="Workspace item type mismatch")

        payload_path = self._item_path(notebook_id, notebook_title, user_id, item_id)
        payload = self._read_item_payload(payload_path)
        current_content = str(payload.get("content") or "").strip()
        next_block = self._compose_capture_block(
            item_type=item_type,
            title=title or item.get("title") or self.DEFAULT_TITLES[item_type],
            text_items=cleaned_items,
            source_refs=incoming_refs,
            prompt=prompt,
        )
        payload["content"] = f"{current_content}\n\n{next_block}".strip() if current_content else next_block
        payload["source_refs"] = self._merge_source_refs(payload.get("source_refs") or [], incoming_refs)

        item["title"] = item.get("title") or (title or "").strip() or self.DEFAULT_TITLES[item_type]
        item["updated_at"] = self._now()
        item["capture_count"] = int(item.get("capture_count") or 0) + 1
        item["source_refs"] = payload["source_refs"]

        self._write_item_payload(payload_path, payload)
        manifest[index] = item
        self._write_manifest(manifest_path, manifest)
        return self._public_item(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            item=item,
            include_content=True,
        )
