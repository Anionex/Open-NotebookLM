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
        "summary": "Summary 卡片",
        "guidance": "产出指导",
    }
    SUMMARY_KIND_ITEM = "item"
    SUMMARY_KIND_ALL = "all"

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

    def _summary_kind(self, item: Dict[str, Any]) -> str:
        if item.get("type") != "summary":
            return ""
        kind = str(item.get("summary_kind") or self.SUMMARY_KIND_ITEM).strip()
        return self.SUMMARY_KIND_ALL if kind == self.SUMMARY_KIND_ALL else self.SUMMARY_KIND_ITEM

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
        public_item = {
            **item,
            "content": content,
            "source_refs": source_refs if isinstance(source_refs, list) else [],
            "capture_count": int(item.get("capture_count") or 0),
        }
        if item.get("type") == "summary":
            public_item["summary_kind"] = self._summary_kind(item)
            source_item_ids = payload.get("source_summary_item_ids") if include_content else item.get("source_summary_item_ids")
            public_item["source_summary_item_ids"] = source_item_ids if isinstance(source_item_ids, list) else []
        return public_item

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
        summary_kind: str = SUMMARY_KIND_ITEM,
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
        if item_type == "summary":
            item["summary_kind"] = self.SUMMARY_KIND_ALL if summary_kind == self.SUMMARY_KIND_ALL else self.SUMMARY_KIND_ITEM
            item["source_summary_item_ids"] = []
        payload = {
            "content": content or "",
            "source_refs": source_refs or [],
        }
        if item_type == "summary":
            payload["source_summary_item_ids"] = []
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
        if item_type == "summary" and self._summary_kind(item) == self.SUMMARY_KIND_ALL:
            raise HTTPException(status_code=400, detail="All summary must be rebuilt from item summaries")

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
        if item_type == "summary":
            item["summary_kind"] = self.SUMMARY_KIND_ITEM
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

    def _compose_all_summary_content(self, item_summaries: List[Dict[str, Any]]) -> str:
        lines: List[str] = [
            "# All Summary",
            "",
            f"> 基于 {len(item_summaries)} 张 item summary 卡片重新总结。",
            "",
            "## 用户当前想获得什么",
            "请基于下方 item summary 继续确认用户当前目标、受众、重点和约束。",
            "",
            "## 已形成的关键理解",
        ]
        for index, summary in enumerate(item_summaries, start=1):
            content = str(summary.get("content") or "").strip()
            title = str(summary.get("title") or f"Item Summary {index}").strip()
            lines.extend([
                "",
                f"### {index}. {title}",
                "",
                content or "（这张 item summary 暂无正文。）",
            ])
        lines.extend([
            "",
            "## 用户偏好与约束",
            "从 item summary 中归并受众、表达风格、必须强调和需要避免的内容。",
            "",
            "## 冲突与不确定",
            "如果 item summary 之间存在冲突，后续重算时应在这里显式列出。",
            "",
            "## 下一步建议",
            "基于 all summary 生成某个产出的 outline guidance，或继续从 Chat 中抽取新的 item summary。",
        ])
        return "\n".join(lines).strip()

    def rebuild_all_summary(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        title: str = "All Summary",
    ) -> Dict[str, Any]:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        item_summaries: List[Dict[str, Any]] = []
        all_index: Optional[int] = None
        all_item: Optional[Dict[str, Any]] = None

        for index, item in enumerate(manifest):
            if item.get("type") != "summary":
                continue
            kind = self._summary_kind(item)
            if kind == self.SUMMARY_KIND_ALL and all_item is None:
                all_index = index
                all_item = item
                continue
            if kind == self.SUMMARY_KIND_ITEM:
                item_summaries.append(
                    self._public_item(
                        notebook_id=notebook_id,
                        notebook_title=notebook_title,
                        user_id=user_id,
                        item=item,
                        include_content=True,
                    )
                )

        if not item_summaries:
            raise HTTPException(status_code=400, detail="No item summaries to rebuild all summary")

        source_ids = [str(item.get("id")) for item in item_summaries if item.get("id")]
        content = self._compose_all_summary_content(item_summaries)
        now = self._now()

        if all_item is None:
            all_item = self.create_item(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                item_type="summary",
                title=title,
                content=content,
                summary_kind=self.SUMMARY_KIND_ALL,
            )
            manifest = self._read_manifest(manifest_path)
            all_index, all_item = self._find_item(manifest, all_item["id"])
        else:
            all_item["title"] = (title or "").strip() or all_item.get("title") or "All Summary"
            all_item["summary_kind"] = self.SUMMARY_KIND_ALL
            all_item["updated_at"] = now

        all_item["source_summary_item_ids"] = source_ids
        payload_path = self._item_path(notebook_id, notebook_title, user_id, str(all_item["id"]))
        payload = self._read_item_payload(payload_path)
        payload["content"] = content
        payload["source_summary_item_ids"] = source_ids
        payload["source_refs"] = []
        self._write_item_payload(payload_path, payload)

        if all_index is None:
            all_index, _ = self._find_item(manifest, str(all_item["id"]))
        manifest[all_index] = all_item
        self._write_manifest(manifest_path, manifest)
        return self._public_item(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            item=all_item,
            include_content=True,
        )
