from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException
from openai import OpenAI

from fastapi_app.config import settings
from fastapi_app.notebook_paths import get_notebook_paths


class DocumentService:
    STATUS_TOKENS = ("[待确认]", "[待补充]", "[仅大纲]")

    def _base_dir(self, notebook_id: str, notebook_title: str, user_id: str) -> Path:
        return get_notebook_paths(notebook_id, notebook_title, user_id).root / "documents"

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
        return {
            **document,
            "content": content,
            "push_traces": push_traces,
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

        resolved_api_url, resolved_api_key = _require_llm_config(None, None)
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
            "输出应该是可以直接放在标题下面的正文，优先使用小标题、要点和简洁段落。"
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
