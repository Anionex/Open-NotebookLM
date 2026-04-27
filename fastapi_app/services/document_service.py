from __future__ import annotations

import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException
from openai import OpenAI

from fastapi_app.config import settings
from fastapi_app.notebook_paths import NotebookPaths
from workflow_engine.utils import get_project_root


class DocumentService:
    STATUS_TOKENS = ("[待确认]", "[待补充]", "[仅大纲]")

    def __init__(self, project_root: Optional[Path] = None) -> None:
        self.project_root = Path(project_root) if project_root is not None else get_project_root()

    def _base_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        """Return the documents directory, preferring workspace/documents/ if it exists.

        The workspace migration may have moved ``documents/`` into
        ``workspace/documents/``.  We check the migrated location first so
        that previously-created documents remain accessible.
        """
        notebook_root = NotebookPaths(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            project_root=self.project_root,
        ).root
        workspace_dir = notebook_root / "workspace" / "documents"
        if workspace_dir.exists():
            return workspace_dir
        return notebook_root / "documents"

    def _manifest_path(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / "documents.json"

    def _current_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / "current"

    def _versions_dir(self, notebook_id: str, notebook_title: str, user_id: str, document_id: str) -> Path:
        return self._base_dir(notebook_id, notebook_title, user_id) / "versions" / document_id

    def _current_path(self, notebook_id: str, notebook_title: str, user_id: str, document_id: str) -> Path:
        return self._current_dir(notebook_id, notebook_title, user_id) / f"{document_id}.md"

    def _current_traces_path(self, notebook_id: str, notebook_title: str, user_id: str, document_id: str) -> Path:
        return self._current_dir(notebook_id, notebook_title, user_id) / f"{document_id}.traces.json"

    def _current_meta_path(self, notebook_id: str, notebook_title: str, user_id: str, document_id: str) -> Path:
        return self._current_dir(notebook_id, notebook_title, user_id) / f"{document_id}.meta.json"

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
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_path, path)

    def _default_focus_state(self) -> Dict[str, Any]:
        return {
            "type": "full",
            "section_ids": [],
            "stash_item_ids": [],
            "description": "焦点：全文",
        }

    def _normalize_focus_state(self, focus_state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(focus_state, dict):
            return self._default_focus_state()
        focus_type = str(focus_state.get("type") or "full").strip()
        if focus_type not in {"full", "sections", "stash_item", "stash"}:
            focus_type = "full"
        section_ids = focus_state.get("section_ids") if isinstance(focus_state.get("section_ids"), list) else []
        stash_item_ids = focus_state.get("stash_item_ids") if isinstance(focus_state.get("stash_item_ids"), list) else []
        description = str(focus_state.get("description") or "").strip()
        if not description:
            description = "焦点：全文" if focus_type == "full" else "焦点：自定义"
        return {
            "type": focus_type,
            "section_ids": [str(item).strip() for item in section_ids if str(item).strip()],
            "stash_item_ids": [str(item).strip() for item in stash_item_ids if str(item).strip()],
            "description": description,
        }

    def _default_meta(self) -> Dict[str, Any]:
        return {
            "focus_state": self._default_focus_state(),
            "stash_items": [],
            "change_logs": [],
            "metadata": {},
        }

    def _read_document_meta(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> Dict[str, Any]:
        payload = self._read_json_payload(
            self._current_meta_path(notebook_id, notebook_title, user_id, document_id),
            {},
        )
        if not isinstance(payload, dict):
            payload = {}
        meta = self._default_meta()
        meta.update(payload)
        meta["focus_state"] = self._normalize_focus_state(meta.get("focus_state"))
        meta["stash_items"] = meta.get("stash_items") if isinstance(meta.get("stash_items"), list) else []
        meta["change_logs"] = meta.get("change_logs") if isinstance(meta.get("change_logs"), list) else []
        meta["metadata"] = meta.get("metadata") if isinstance(meta.get("metadata"), dict) else {}
        return meta

    def _write_document_meta(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        meta: Dict[str, Any],
    ) -> None:
        meta["focus_state"] = self._normalize_focus_state(meta.get("focus_state"))
        self._write_json_payload(
            self._current_meta_path(notebook_id, notebook_title, user_id, document_id),
            meta,
        )

    def _read_push_traces(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> List[Dict[str, Any]]:
        data = self._read_json_payload(
            self._current_traces_path(notebook_id, notebook_title, user_id, document_id),
            [],
        )
        return data if isinstance(data, list) else []

    def _write_push_traces(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        traces: List[Dict[str, Any]],
    ) -> None:
        path = self._current_traces_path(notebook_id, notebook_title, user_id, document_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(traces, ensure_ascii=False, indent=2), encoding="utf-8")

    def _slugify(self, text: str, fallback: str = "梳理文档") -> str:
        safe = re.sub(r"[^\w\u4e00-\u9fff\-]+", "_", (text or "").strip())
        safe = re.sub(r"_+", "_", safe).strip("_.- ")
        return safe or fallback

    def _extract_status_tokens(self, content: str) -> Dict[str, int]:
        content = content or ""
        counts: Dict[str, int] = {}
        for token in self.STATUS_TOKENS:
            counts[token] = content.count(token)
        return counts

    def _find_document(self, manifest: List[Dict[str, Any]], document_id: str) -> tuple[int, Dict[str, Any]]:
        for index, item in enumerate(manifest):
            if item.get("id") == document_id:
                return index, item
        raise HTTPException(status_code=404, detail="Document not found")

    def _snapshot_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document: Dict[str, Any],
        content: str,
        reason: str,
        push_traces: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        version_id = f"ver_{uuid4().hex[:12]}"
        payload = {
            "id": version_id,
            "document_id": document["id"],
            "title": document.get("title") or "",
            "reason": reason,
            "content": content,
            "created_at": self._now(),
            "status_tokens": self._extract_status_tokens(content),
            "push_traces": push_traces
            if push_traces is not None
            else self._read_push_traces(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document_id=document["id"],
            ),
        }
        version_path = self._versions_dir(notebook_id, notebook_title, user_id, document["id"]) / f"{version_id}.json"
        version_path.parent.mkdir(parents=True, exist_ok=True)
        version_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        document["current_version_id"] = version_id
        document["version_count"] = int(document.get("version_count") or 0) + 1
        document["status_tokens"] = payload["status_tokens"]
        return payload

    def _public_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document: Dict[str, Any],
        include_content: bool = False,
    ) -> Dict[str, Any]:
        current_path = self._current_path(notebook_id, notebook_title, user_id, document["id"])
        content = ""
        push_traces: List[Dict[str, Any]] = []
        if include_content and current_path.exists():
            content = current_path.read_text(encoding="utf-8")
            push_traces = self._read_push_traces(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document_id=document["id"],
            )
        meta = self._read_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document["id"],
        )
        return {
            **document,
            "content": content,
            "push_traces": push_traces,
            "document_type": document.get("document_type") or "summary_doc",
            "focus_state": meta["focus_state"],
            "stash_items": meta["stash_items"],
            "change_logs": meta["change_logs"] if include_content else [],
            "metadata": meta["metadata"],
            "status_tokens": document.get("status_tokens") or {},
            "version_count": int(document.get("version_count") or 0),
        }

    def _compose_push_block(
        self,
        *,
        mode: str,
        title: str,
        text_items: List[str],
        source_refs: List[Dict[str, Any]],
        prompt: str = "",
    ) -> str:
        heading = self._slugify(title or "新增整理")
        lines: List[str] = [f"## {heading}"]
        cleaned_prompt = str(prompt or "").strip()
        if source_refs:
            ref_names = [str(item.get("name") or item.get("title") or item.get("source") or "").strip() for item in source_refs]
            ref_names = [item for item in ref_names if item]
            if ref_names:
                lines.append("")
                lines.append(f"> 来源: {' / '.join(ref_names[:8])}")
        if cleaned_prompt:
            lines.append("")
            lines.append(f"> 整理要求: {cleaned_prompt}")
        lines.append("")
        if mode == "organize":
            for idx, item in enumerate(text_items, start=1):
                cleaned = item.strip()
                if not cleaned:
                    continue
                lines.append(f"### 要点 {idx}")
                lines.append("")
                bullet_lines = [segment.strip() for segment in re.split(r"[\n。；;]+", cleaned) if segment.strip()]
                if not bullet_lines:
                    bullet_lines = [cleaned]
                for bullet in bullet_lines[:8]:
                    lines.append(f"- {bullet}")
                lines.append("")
        elif mode == "merge":
            merged = "\n\n".join(item.strip() for item in text_items if item.strip())
            lines.append(merged or "[待补充]")
        else:
            for item in text_items:
                cleaned = item.strip()
                if cleaned:
                    lines.append(cleaned)
                    lines.append("")
        return "\n".join(lines).strip()

    def _compose_generated_block(
        self,
        *,
        title: str,
        body: str,
        source_refs: List[Dict[str, Any]],
        prompt: str = "",
    ) -> str:
        heading = self._slugify(title or "新增整理")
        lines: List[str] = [f"## {heading}"]
        ref_names = [str(item.get("name") or item.get("title") or item.get("source") or "").strip() for item in source_refs]
        ref_names = [item for item in ref_names if item]
        cleaned_prompt = str(prompt or "").strip()
        if ref_names:
            lines.extend(["", f"> 来源: {' / '.join(ref_names[:8])}"])
        if cleaned_prompt:
            lines.extend(["", f"> 整理要求: {cleaned_prompt}"])
        cleaned_body = self._strip_code_fences(body).strip()
        if cleaned_body:
            lines.extend(["", cleaned_body])
        else:
            lines.extend(["", "[待补充]"])
        return "\n".join(lines).strip()

    def _section_id(self, heading: str, occurrence: int) -> str:
        slug = re.sub(r"[^\w\u4e00-\u9fff\-]+", "-", str(heading or "").strip(), flags=re.UNICODE)
        slug = re.sub(r"-+", "-", slug).strip("-").lower() or "section"
        return f"section-{slug}-{occurrence}"

    def _detect_markdown_module_heading_level(self, content: str) -> int:
        counts: Dict[int, int] = {}
        for line in (content or "").splitlines():
            match = re.match(r"^(#{1,6})\s+.+?\s*$", line)
            if not match:
                continue
            level = len(match.group(1))
            counts[level] = int(counts.get(level, 0)) + 1
        for level in range(1, 7):
            if int(counts.get(level, 0)) >= 2:
                return level
        for level in range(1, 7):
            if int(counts.get(level, 0)) > 0:
                return level
        return 2

    def _parse_markdown_sections(self, content: str, *, document_type: str = "summary_doc") -> List[Dict[str, Any]]:
        lines = (content or "").splitlines()
        heading_indexes: List[tuple[int, str]] = []
        heading_level = self._detect_markdown_module_heading_level(content) if document_type == "output_doc" else 2
        heading_pattern = re.compile(rf"^#{{{heading_level}}}\s+(.+?)\s*$")
        for index, line in enumerate(lines):
            match = heading_pattern.match(line)
            if match:
                heading_indexes.append((index, match.group(1).strip()))
        sections: List[Dict[str, Any]] = []
        heading_counts: Dict[str, int] = {}
        for pos, (start, heading) in enumerate(heading_indexes):
            occurrence = int(heading_counts.get(heading, 0)) + 1
            heading_counts[heading] = occurrence
            end = heading_indexes[pos + 1][0] if pos + 1 < len(heading_indexes) else len(lines)
            sections.append(
                {
                    "id": self._section_id(heading, occurrence),
                    "heading": heading,
                    "start": start,
                    "end": end,
                    "text": "\n".join(lines[start:end]).strip(),
                }
            )
        return sections

    def _resolve_push_target(
        self,
        *,
        document_id: str,
        content: str,
        target: Optional[Dict[str, Any]],
        meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        raw_target = target if isinstance(target, dict) else {"type": "document_end"}
        target_type = str(raw_target.get("type") or "document_end").strip()
        if target_type == "focus":
            focus_state = self._normalize_focus_state(meta.get("focus_state"))
            if focus_state["type"] == "sections" and focus_state["section_ids"]:
                target_type = "section"
                raw_target = {**raw_target, "section_id": focus_state["section_ids"][0]}
            elif focus_state["type"] == "stash":
                target_type = "stash"
            elif focus_state["type"] == "stash_item" and focus_state["stash_item_ids"]:
                target_type = "stash_item"
                raw_target = {**raw_target, "stash_item_id": focus_state["stash_item_ids"][0]}
            else:
                target_type = "document_end"

        if target_type == "section":
            section_id = str(raw_target.get("section_id") or "").strip()
            for section in self._parse_markdown_sections(content, document_type=str(meta.get("document_type") or "summary_doc")):
                if section["id"] == section_id:
                    return {
                        "type": "section",
                        "section_id": section_id,
                        "section": section,
                    }
            raise HTTPException(status_code=404, detail="Target section not found")

        if target_type == "new_section":
            heading = str(raw_target.get("heading") or raw_target.get("title") or "新增章节").strip()
            return {"type": "new_section", "heading": heading}

        if target_type in {"stash", "stash_item", "document_end"}:
            resolved = {"type": target_type}
            if target_type == "stash_item":
                resolved["stash_item_id"] = str(raw_target.get("stash_item_id") or "").strip()
            return resolved

        return {"type": "document_end"}

    def _compose_structured_push_block(
        self,
        *,
        transform: str,
        title: str,
        text_items: List[str],
        source_refs: List[Dict[str, Any]],
        prompt: str,
        api_url: Optional[str],
        api_key: Optional[str],
        model: Optional[str],
    ) -> str:
        if transform == "ai_append":
            body = self._organize_with_ai(
                title=title,
                text_items=text_items,
                source_refs=source_refs,
                prompt=prompt,
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
            return self._strip_code_fences(body).strip()
        return "\n\n".join(item.strip() for item in text_items if item.strip()).strip()

    def _apply_structured_push_content(
        self,
        *,
        original: str,
        resolved_target: Dict[str, Any],
        block: str,
        transform: str,
        title: str,
        source_refs: List[Dict[str, Any]],
        prompt: str,
        api_url: Optional[str],
        api_key: Optional[str],
        model: Optional[str],
    ) -> tuple[str, str, int, int]:
        target_type = resolved_target["type"]
        if target_type == "section":
            section = resolved_target["section"]
            lines = original.splitlines()
            if transform == "ai_merge":
                merged_section = self._merge_with_ai(
                    original=section["text"],
                    title=title,
                    text_items=[block],
                    source_refs=source_refs,
                    prompt=prompt,
                    api_url=api_url,
                    api_key=api_key,
                    model=model,
                )
                replacement_lines = self._strip_code_fences(merged_section).splitlines()
            else:
                existing = "\n".join(lines[section["start"]:section["end"]]).rstrip()
                replacement = f"{existing}\n\n{block}".strip()
                replacement_lines = replacement.splitlines()
            next_lines = [*lines[: section["start"]], *replacement_lines, *lines[section["end"] :]]
            line_start = section["start"] + 1
            line_end = line_start + max(0, len(replacement_lines) - 1)
            return "\n".join(next_lines).strip(), "\n".join(replacement_lines).strip(), line_start, line_end

        if target_type == "new_section":
            heading = resolved_target.get("heading") or title or "新增章节"
            section_block = f"## {heading}\n\n{block}".strip()
            next_content = f"{original.rstrip()}\n\n{section_block}".strip() if original.strip() else section_block
            prefix = next_content[: next_content.rfind(section_block)] if section_block in next_content else ""
            line_start = prefix.count("\n") + 1 if prefix else 1
            return next_content, section_block, line_start, line_start + section_block.count("\n")

        doc_block = block
        next_content = f"{original.rstrip()}\n\n{doc_block}".strip() if original.strip() else doc_block
        prefix = next_content[: next_content.rfind(doc_block)] if doc_block in next_content else ""
        line_start = prefix.count("\n") + 1 if prefix else 1
        return next_content, doc_block, line_start, line_start + doc_block.count("\n")

    def _strip_code_fences(self, text: str) -> str:
        cleaned = str(text or "").strip()
        fenced = re.match(r"^```(?:markdown|md)?\s*(.*?)```$", cleaned, re.DOTALL | re.IGNORECASE)
        if fenced:
            return fenced.group(1).strip()
        return cleaned

    def _normalize_base_url(self, api_url: str) -> str:
        base = str(api_url or "").strip().rstrip("/")
        if base.endswith("/chat/completions"):
            return base[: -len("/chat/completions")]
        return base

    def _run_llm(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> str:
        from fastapi_app.routers.kb import _require_llm_config

        resolved_api_url, resolved_api_key = _require_llm_config(api_url, api_key)
        resolved_model = (model or settings.KB_CHAT_MODEL or settings.LLM_MODEL or "").strip()
        if not resolved_model:
            raise HTTPException(status_code=400, detail="Missing model configuration for document AI push")
        client = OpenAI(
            api_key=resolved_api_key,
            base_url=self._normalize_base_url(resolved_api_url),
            timeout=90.0,
        )
        try:
            response = client.chat.completions.create(
                model=resolved_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Document AI organize failed: {str(exc) or exc.__class__.__name__}",
            ) from exc
        content = response.choices[0].message.content if response.choices else ""
        if isinstance(content, list):
            content = "\n".join(
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict)
            )
        result = self._strip_code_fences(str(content or ""))
        if not result.strip():
            raise HTTPException(status_code=502, detail="LLM returned empty content for document push")
        return result.strip()

    def _organize_with_ai(
        self,
        *,
        title: str,
        text_items: List[str],
        source_refs: List[Dict[str, Any]],
        prompt: str = "",
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> str:
        source_names = [str(item.get("name") or item.get("title") or item.get("source") or "").strip() for item in source_refs]
        source_names = [item for item in source_names if item]
        system_prompt = (
            "你是 ThinkFlow 的文档整理助手。"
            "请把用户给出的对话片段整理成适合写入 Markdown 文档的结构化内容。"
            "不要返回代码块，不要写解释，不要重复来源或整理要求。"
            "Markdown 层级规则：最大标题只能使用二级标题 ##；不要输出一级标题 #；主要模块必须用 ##，不要把主要模块写成 ###。"
            "输出应该是可以直接放进文档的正文，优先使用 ## 模块标题、要点和简洁段落。"
        )
        user_prompt = "\n\n".join(
            [
                f"目标标题：{title or '新增整理'}",
                f"来源：{' / '.join(source_names[:8])}" if source_names else "来源：未提供",
                f"整理要求：{prompt}" if str(prompt or "").strip() else "整理要求：请提炼关键结论、依据与待确认点。",
                "待整理内容：",
                "\n\n".join(text_items),
            ]
        )
        return self._run_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            api_url=api_url,
            api_key=api_key,
            model=model,
        )

    def _merge_with_ai(
        self,
        *,
        original: str,
        title: str,
        text_items: List[str],
        source_refs: List[Dict[str, Any]],
        prompt: str = "",
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> str:
        source_names = [str(item.get("name") or item.get("title") or item.get("source") or "").strip() for item in source_refs]
        source_names = [item for item in source_names if item]
        system_prompt = (
            "你是 ThinkFlow 的文档融合助手。"
            "请把新增信息融合进现有 Markdown 文档，输出完整的新文档全文。"
            "尽量保留现有结构和已经确认的内容，只在必要位置改写、新增或补充。"
            "Markdown 层级规则：最大标题只能使用二级标题 ##；不要输出一级标题 #；主要模块必须用 ##，不要把主要模块写成 ###。"
            "不要返回代码块，不要写解释。"
        )
        user_prompt = "\n\n".join(
            [
                f"新增内容标题：{title or '新增整理'}",
                f"来源：{' / '.join(source_names[:8])}" if source_names else "来源：未提供",
                f"融合要求：{prompt}" if str(prompt or "").strip() else "融合要求：把新增信息自然合并进最合适的章节。",
                "现有文档：",
                original,
                "新增信息：",
                "\n\n".join(text_items),
            ]
        )
        return self._run_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            api_url=api_url,
            api_key=api_key,
            model=model,
        )

    def list_documents(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        manifest = self._read_manifest(self._manifest_path(notebook_id, notebook_title, user_id))
        items = [
            self._public_document(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document=item,
            )
            for item in manifest
        ]
        return sorted(items, key=lambda item: str(item.get("updated_at") or ""), reverse=True)

    def create_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        title: str,
        content: str = "",
        document_type: str = "summary_doc",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        now = self._now()
        document = {
            "id": f"doc_{uuid4().hex[:12]}",
            "title": (title or "").strip() or "梳理文档",
            "created_at": now,
            "updated_at": now,
            "current_version_id": None,
            "version_count": 0,
            "status_tokens": self._extract_status_tokens(content),
            "document_type": document_type if document_type in {"summary_doc", "output_doc"} else "summary_doc",
        }
        current_path = self._current_path(notebook_id, notebook_title, user_id, document["id"])
        current_path.parent.mkdir(parents=True, exist_ok=True)
        current_path.write_text(content or "", encoding="utf-8")
        self._write_push_traces(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document["id"],
            traces=[],
        )
        self._write_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document["id"],
            meta={
                "focus_state": self._default_focus_state(),
                "stash_items": [],
                "change_logs": [],
                "metadata": metadata or {},
            },
        )
        self._snapshot_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            content=content or "",
            reason="create",
            push_traces=[],
        )
        manifest.append(document)
        self._write_manifest(manifest_path, manifest)
        return self._public_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            include_content=True,
        )

    def update_focus_state(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        focus_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        self.get_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        meta = self._read_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        meta["focus_state"] = self._normalize_focus_state(focus_state)
        self._write_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            meta=meta,
        )
        return meta["focus_state"]

    def add_stash_item(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        content: str,
        source_refs: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        self.get_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        meta = self._read_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        item = {
            "id": f"stash_{uuid4().hex[:12]}",
            "content": str(content or "").strip(),
            "source_refs": source_refs or [],
            "created_at": self._now(),
            "updated_at": self._now(),
        }
        if not item["content"]:
            raise HTTPException(status_code=400, detail="Stash item content is required")
        meta["stash_items"] = [*(meta.get("stash_items") or []), item]
        self._write_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            meta=meta,
        )
        self.append_change_log(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            change_type="stash-add",
            summary="新增暂存区内容",
        )
        return item

    def append_change_log(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        change_type: str,
        summary: str,
        related_conv: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self.get_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        meta = self._read_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        entry = {
            "id": f"chg_{uuid4().hex[:12]}",
            "timestamp": self._now(),
            "doc_id": document_id,
            "type": str(change_type or "update").strip() or "update",
            "summary": str(summary or "").strip() or "文档发生更新",
            "related_conv": str(related_conv or "").strip() or None,
            "metadata": metadata or {},
        }
        logs = meta.get("change_logs") if isinstance(meta.get("change_logs"), list) else []
        meta["change_logs"] = [entry, *logs][:100]
        self._write_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            meta=meta,
        )
        return entry

    def list_change_logs(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> List[Dict[str, Any]]:
        self.get_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        meta = self._read_document_meta(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        return meta["change_logs"]

    def get_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> Dict[str, Any]:
        manifest = self._read_manifest(self._manifest_path(notebook_id, notebook_title, user_id))
        _, document = self._find_document(manifest, document_id)
        return self._public_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            include_content=True,
        )

    def update_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
    ) -> Dict[str, Any]:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, document = self._find_document(manifest, document_id)
        current_path = self._current_path(notebook_id, notebook_title, user_id, document_id)
        current_text = current_path.read_text(encoding="utf-8") if current_path.exists() else ""
        next_content = current_text if content is None else content
        existing_traces = self._read_push_traces(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        if title is not None:
            document["title"] = (title or "").strip() or document.get("title") or "梳理文档"
        document["updated_at"] = self._now()
        current_path.parent.mkdir(parents=True, exist_ok=True)
        current_path.write_text(next_content or "", encoding="utf-8")
        self._snapshot_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            content=next_content or "",
            reason="update",
            push_traces=existing_traces,
        )
        manifest[index] = document
        self._write_manifest(manifest_path, manifest)
        return self._public_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            include_content=True,
        )

    def delete_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> None:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, document = self._find_document(manifest, document_id)
        manifest.pop(index)
        self._write_manifest(manifest_path, manifest)

        current_path = self._current_path(notebook_id, notebook_title, user_id, document_id)
        traces_path = self._current_traces_path(notebook_id, notebook_title, user_id, document_id)
        versions_dir = self._versions_dir(notebook_id, notebook_title, user_id, document_id)

        if current_path.exists():
            current_path.unlink()
        if traces_path.exists():
            traces_path.unlink()
        if versions_dir.exists():
            shutil.rmtree(versions_dir, ignore_errors=True)

    def push_document(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        mode: str,
        title: str,
        text_items: List[str],
        source_refs: Optional[List[Dict[str, Any]]] = None,
        prompt: str = "",
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        target: Optional[Dict[str, Any]] = None,
        transform: Optional[str] = None,
        related_conv: Optional[str] = None,
    ) -> Dict[str, Any]:
        cleaned_items = [str(item or "").strip() for item in text_items if str(item or "").strip()]
        if not cleaned_items:
            raise HTTPException(status_code=400, detail="No text to push")
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, document = self._find_document(manifest, document_id)
        current_path = self._current_path(notebook_id, notebook_title, user_id, document_id)
        original = current_path.read_text(encoding="utf-8") if current_path.exists() else ""
        traces = self._read_push_traces(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
        )
        refs = source_refs or []
        if target is not None or transform is not None:
            normalized_transform = str(transform or "").strip() or (
                "ai_append" if mode == "organize" else "ai_merge" if mode == "merge" else "raw_append"
            )
            if normalized_transform not in {"raw_append", "ai_append", "ai_merge"}:
                raise HTTPException(status_code=400, detail="Unsupported push transform")
            meta = self._read_document_meta(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document_id=document_id,
            )
            meta["document_type"] = document.get("document_type") or "summary_doc"
            resolved_target = self._resolve_push_target(
                document_id=document_id,
                content=original,
                target=target,
                meta=meta,
            )
            if normalized_transform == "ai_merge" and resolved_target["type"] not in {"section"}:
                raise HTTPException(status_code=400, detail="AI merge is only available for existing section targets")
            if resolved_target["type"] == "stash":
                if normalized_transform == "ai_merge":
                    raise HTTPException(status_code=400, detail="AI merge is not available for stash targets")
                block = self._compose_structured_push_block(
                    transform=normalized_transform,
                    title=title,
                    text_items=cleaned_items,
                    source_refs=refs,
                    prompt=prompt,
                    api_url=api_url,
                    api_key=api_key,
                    model=model,
                )
                stash_item = self.add_stash_item(
                    notebook_id=notebook_id,
                    notebook_title=notebook_title,
                    user_id=user_id,
                    document_id=document_id,
                    content=block,
                    source_refs=refs,
                )
                trace = {
                    "id": f"trace_{uuid4().hex[:12]}",
                    "mode": mode,
                    "transform": normalized_transform,
                    "target": resolved_target,
                    "title": str(title or "").strip(),
                    "prompt": str(prompt or "").strip(),
                    "created_at": self._now(),
                    "updated_at": self._now(),
                    "line_start": 0,
                    "line_end": 0,
                    "text_preview": "\n\n".join(cleaned_items)[:320],
                    "block_text": block,
                    "source_refs": refs,
                }
                traces.append(trace)
                self._write_push_traces(
                    notebook_id=notebook_id,
                    notebook_title=notebook_title,
                    user_id=user_id,
                    document_id=document_id,
                    traces=traces,
                )
                self.append_change_log(
                    notebook_id=notebook_id,
                    notebook_title=notebook_title,
                    user_id=user_id,
                    document_id=document_id,
                    change_type="ai-push",
                    summary=f"推送到暂存区：{title or '未命名内容'}",
                    related_conv=related_conv,
                    metadata={"trace_id": trace["id"], "target": resolved_target, "transform": normalized_transform},
                )
                return {
                    "document": self.get_document(
                        notebook_id=notebook_id,
                        notebook_title=notebook_title,
                        user_id=user_id,
                        document_id=document_id,
                    ),
                    "appended_block": block,
                    "trace": trace,
                    "stash_item": stash_item,
                }

            block = self._compose_structured_push_block(
                transform=normalized_transform if normalized_transform != "ai_merge" else "raw_append",
                title=title,
                text_items=cleaned_items,
                source_refs=refs,
                prompt=prompt,
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
            next_content, applied_block, line_start, line_end = self._apply_structured_push_content(
                original=original,
                resolved_target=resolved_target,
                block=block,
                transform=normalized_transform,
                title=title,
                source_refs=refs,
                prompt=prompt,
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
            current_path.parent.mkdir(parents=True, exist_ok=True)
            current_path.write_text(next_content, encoding="utf-8")
            trace = {
                "id": f"trace_{uuid4().hex[:12]}",
                "mode": mode,
                "transform": normalized_transform,
                "target": {key: value for key, value in resolved_target.items() if key != "section"},
                "title": str(title or "").strip(),
                "prompt": str(prompt or "").strip(),
                "created_at": self._now(),
                "updated_at": self._now(),
                "line_start": line_start,
                "line_end": line_end,
                "text_preview": "\n\n".join(cleaned_items)[:320],
                "block_text": applied_block,
                "source_refs": refs,
            }
            traces.append(trace)
            self._write_push_traces(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document_id=document_id,
                traces=traces,
            )
            document["updated_at"] = self._now()
            document["last_push"] = {
                "mode": mode,
                "transform": normalized_transform,
                "target": trace["target"],
                "title": title,
                "item_count": len(cleaned_items),
                "prompt": str(prompt or "").strip(),
                "updated_at": document["updated_at"],
                "trace_id": trace["id"],
            }
            self._snapshot_document(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document=document,
                content=next_content,
                reason=f"push:{normalized_transform}",
                push_traces=traces,
            )
            manifest[index] = document
            self._write_manifest(manifest_path, manifest)
            self.append_change_log(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document_id=document_id,
                change_type="ai-push",
                summary=f"推送到{trace['target'].get('type')}: {title or '未命名内容'}",
                related_conv=related_conv,
                metadata={"trace_id": trace["id"], "target": trace["target"], "transform": normalized_transform},
            )
            return {
                "document": self._public_document(
                    notebook_id=notebook_id,
                    notebook_title=notebook_title,
                    user_id=user_id,
                    document=document,
                    include_content=True,
                ),
                "appended_block": applied_block,
                "trace": trace,
            }

        if mode == "organize":
            organized_body = self._organize_with_ai(
                title=title,
                text_items=cleaned_items,
                source_refs=refs,
                prompt=prompt,
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
            block = self._compose_generated_block(
                title=title,
                body=organized_body,
                source_refs=refs,
                prompt=prompt,
            )
            next_content = f"{original.rstrip()}\n\n{block}".strip() if original.strip() else block
        elif mode == "merge" and original.strip():
            next_content = self._merge_with_ai(
                original=original,
                title=title,
                text_items=cleaned_items,
                source_refs=refs,
                prompt=prompt,
                api_url=api_url,
                api_key=api_key,
                model=model,
            )
            block = next_content
        else:
            block = self._compose_push_block(
                mode=mode,
                title=title,
                text_items=cleaned_items,
                source_refs=refs,
                prompt=prompt,
            )
            next_content = f"{original.rstrip()}\n\n{block}".strip() if original.strip() else block
        current_path.parent.mkdir(parents=True, exist_ok=True)
        current_path.write_text(next_content, encoding="utf-8")
        if mode == "merge" and original.strip():
            line_start = 1
            line_end = next_content.count("\n") + 1 if next_content else 1
        else:
            block_offset = next_content.rfind(block)
            prefix = next_content[:block_offset] if block_offset >= 0 else ""
            line_start = prefix.count("\n") + 1 if prefix else 1
            line_end = line_start + block.count("\n")
        trace = {
            "id": f"trace_{uuid4().hex[:12]}",
            "mode": mode,
            "title": str(title or "").strip(),
            "prompt": str(prompt or "").strip(),
            "created_at": self._now(),
            "updated_at": self._now(),
            "line_start": line_start,
            "line_end": line_end,
            "text_preview": "\n\n".join(cleaned_items)[:320],
            "block_text": block,
            "source_refs": source_refs or [],
        }
        traces.append(trace)
        self._write_push_traces(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            traces=traces,
        )
        document["updated_at"] = self._now()
        document["last_push"] = {
            "mode": mode,
            "title": title,
            "item_count": len(cleaned_items),
            "prompt": str(prompt or "").strip(),
            "updated_at": document["updated_at"],
            "trace_id": trace["id"],
        }
        self._snapshot_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            content=next_content,
            reason=f"push:{mode}",
            push_traces=traces,
        )
        manifest[index] = document
        self._write_manifest(manifest_path, manifest)
        return {
            "document": self._public_document(
                notebook_id=notebook_id,
                notebook_title=notebook_title,
                user_id=user_id,
                document=document,
                include_content=True,
            ),
            "appended_block": block,
            "trace": trace,
        }

    def list_versions(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
    ) -> List[Dict[str, Any]]:
        version_dir = self._versions_dir(notebook_id, notebook_title, user_id, document_id)
        if not version_dir.exists():
            return []
        items: List[Dict[str, Any]] = []
        for path in sorted(version_dir.glob("*.json"), reverse=True):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            items.append({
                "id": payload.get("id"),
                "document_id": payload.get("document_id"),
                "title": payload.get("title"),
                "reason": payload.get("reason"),
                "created_at": payload.get("created_at"),
                "status_tokens": payload.get("status_tokens") or {},
                "preview": (payload.get("content") or "")[:600],
            })
        return items

    def restore_version(
        self,
        *,
        notebook_id: str,
        notebook_title: str,
        user_id: str,
        document_id: str,
        version_id: str,
    ) -> Dict[str, Any]:
        manifest_path = self._manifest_path(notebook_id, notebook_title, user_id)
        manifest = self._read_manifest(manifest_path)
        index, document = self._find_document(manifest, document_id)
        version_path = self._versions_dir(notebook_id, notebook_title, user_id, document_id) / f"{version_id}.json"
        if not version_path.exists():
            raise HTTPException(status_code=404, detail="Version not found")
        payload = json.loads(version_path.read_text(encoding="utf-8"))
        content = str(payload.get("content") or "")
        push_traces = payload.get("push_traces") if isinstance(payload.get("push_traces"), list) else []
        current_path = self._current_path(notebook_id, notebook_title, user_id, document_id)
        current_path.parent.mkdir(parents=True, exist_ok=True)
        current_path.write_text(content, encoding="utf-8")
        self._write_push_traces(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document_id=document_id,
            traces=push_traces,
        )
        document["updated_at"] = self._now()
        self._snapshot_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            content=content,
            reason=f"restore:{version_id}",
            push_traces=push_traces,
        )
        manifest[index] = document
        self._write_manifest(manifest_path, manifest)
        return self._public_document(
            notebook_id=notebook_id,
            notebook_title=notebook_title,
            user_id=user_id,
            document=document,
            include_content=True,
        )
