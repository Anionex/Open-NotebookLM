from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from fastapi_app.notebook_paths import NotebookPaths
from workflow_engine.utils import get_project_root


class ConversationWorkspaceService:
    """Persist product workspace state that belongs to a conversation.

    Chat messages may still live in Supabase. This service stores the local
    ThinkFlow product state that must survive reloads: source references,
    active document binding, and the last message timestamp used for document
    change summaries.
    """

    ALLOWED_SOURCE_TYPES = {"material", "document", "output_document"}

    def __init__(self, project_root: Optional[Path] = None) -> None:
        self.project_root = Path(project_root) if project_root is not None else get_project_root()

    def _base_dir(self, *, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        paths = NotebookPaths(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            project_root=self.project_root,
        )
        return paths.root / "workspace" / "conversations"

    def _state_path(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
    ) -> Path:
        safe_id = self._safe_conversation_id(conversation_id)
        return self._base_dir(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
        ) / "current" / f"{safe_id}.json"

    def _safe_conversation_id(self, conversation_id: str) -> str:
        cleaned = str(conversation_id or "").strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="conversation_id is required")
        return cleaned.replace("/", "_").replace("\\", "_")[:160]

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _default_state(self, conversation_id: str) -> Dict[str, Any]:
        return {
            "conversation_id": conversation_id,
            "source_refs": [],
            "active_document_id": "",
            "last_sent_at": None,
            "created_at": self._now(),
            "updated_at": self._now(),
        }

    def _read_state(self, path: Path, conversation_id: str) -> Dict[str, Any]:
        if not path.exists():
            return self._default_state(conversation_id)
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                return self._default_state(conversation_id)
        except Exception:
            return self._default_state(conversation_id)
        state = self._default_state(conversation_id)
        state.update(payload)
        state["conversation_id"] = conversation_id
        state["source_refs"] = self._normalize_source_refs(state.get("source_refs") or [])
        state["active_document_id"] = str(state.get("active_document_id") or "").strip()
        state["last_sent_at"] = state.get("last_sent_at") or None
        return state

    def _write_state(self, path: Path, state: Dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        state["updated_at"] = self._now()
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        tmp_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_path, path)

    def _normalize_source_refs(self, source_refs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for raw in source_refs or []:
            if not isinstance(raw, dict):
                continue
            source_id = str(raw.get("id") or raw.get("source_id") or "").strip()
            if not source_id:
                continue
            source_type = str(raw.get("type") or raw.get("source_type") or "material").strip()
            if source_type not in self.ALLOWED_SOURCE_TYPES:
                source_type = "material"
            key = (source_type, source_id)
            if key in seen:
                continue
            seen.add(key)
            normalized.append(
                {
                    "id": source_id,
                    "type": source_type,
                    "title": str(raw.get("title") or raw.get("name") or "").strip(),
                    "path": str(raw.get("path") or raw.get("url") or "").strip(),
                    "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
                }
            )
        return normalized

    def get_state(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
    ) -> Dict[str, Any]:
        path = self._state_path(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            conversation_id=conversation_id,
        )
        return self._read_state(path, conversation_id)

    def update_state(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
        source_refs: Optional[List[Dict[str, Any]]] = None,
        active_document_id: Optional[str] = None,
        last_sent_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        path = self._state_path(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            conversation_id=conversation_id,
        )
        state = self._read_state(path, conversation_id)
        if source_refs is not None:
            state["source_refs"] = self._normalize_source_refs(source_refs)
        if active_document_id is not None:
            state["active_document_id"] = str(active_document_id or "").strip()
        if last_sent_at is not None:
            state["last_sent_at"] = str(last_sent_at or "").strip() or None
        self._write_state(path, state)
        return self._read_state(path, conversation_id)

    def set_source_refs(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
        source_refs: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return self.update_state(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            conversation_id=conversation_id,
            source_refs=source_refs,
        )

    def set_active_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
        active_document_id: str,
    ) -> Dict[str, Any]:
        return self.update_state(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            conversation_id=conversation_id,
            active_document_id=active_document_id,
        )

    def mark_sent(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        conversation_id: str,
        sent_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.update_state(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            conversation_id=conversation_id,
            last_sent_at=sent_at or self._now(),
        )
