# Source-First Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow formal outputs to be generated from selected sources without requiring or auto-creating a structured document.

**Architecture:** Keep the existing output v2 API and artifact model, but make `document_id` optional for non-PPT outputs. Build a reusable source-first context markdown from optional document content, selected source file text, bound documents, and guidance; feed that context into outline and final generation paths.

**Tech Stack:** FastAPI service code in Python, React/Vite frontend, pytest backend tests, Playwright smoke tests.

---

## Files

- Modify: `fastapi_app/routers/kb_outputs_v2.py`
- Modify: `fastapi_app/services/output_v2_service.py`
- Create: `fastapi_app/tests/test_source_first_output.py`
- Modify: `frontend/src/components/ThinkFlowWorkspace.tsx`
- Modify: `frontend/src/components/DocumentPanelSection.tsx`
- Modify: `frontend/tests/i18n.spec.js`

## Task 1: Backend Allows Source-Only Non-PPT Outlines

**Files:**
- Modify: `fastapi_app/routers/kb_outputs_v2.py`
- Modify: `fastapi_app/services/output_v2_service.py`
- Create: `fastapi_app/tests/test_source_first_output.py`

- [ ] **Step 1: Write failing backend tests**

Create `fastapi_app/tests/test_source_first_output.py` with tests that prove non-PPT outline creation accepts source-only input and rejects truly empty context.

```python
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi_app.services.output_v2_service import OutputV2Service


@pytest.mark.asyncio
async def test_non_ppt_outline_allows_sources_without_document(monkeypatch, tmp_path):
    source = tmp_path / "source.md"
    source.write_text("# Source\n\nCore source fact.\n\nSecond point.", encoding="utf-8")

    service = OutputV2Service()
    monkeypatch.setattr(service, "_base_dir", lambda *_args, **_kwargs: tmp_path / "outputs")

    item = await service.create_outline(
        notebook_id="nb-source-first",
        notebook_title="Notebook",
        user_id="user@example.com",
        document_id="",
        target_type="report",
        title="Source report",
        prompt="",
        page_count=4,
        guidance_item_ids=[],
        source_paths=[str(source)],
        source_names=["source.md"],
        bound_document_ids=[],
    )

    assert item["document_id"] == ""
    assert item["source_paths"] == [str(source)]
    assert item["source_names"] == ["source.md"]
    assert item["source_document_path"] == ""
    assert item["outline"]
    serialized_outline = str(item["outline"])
    assert "Source" in serialized_outline or "Core source fact" in serialized_outline


@pytest.mark.asyncio
async def test_non_ppt_outline_rejects_empty_context(monkeypatch, tmp_path):
    service = OutputV2Service()
    monkeypatch.setattr(service, "_base_dir", lambda *_args, **_kwargs: tmp_path / "outputs")

    with pytest.raises(HTTPException) as exc_info:
        await service.create_outline(
            notebook_id="nb-source-first",
            notebook_title="Notebook",
            user_id="user@example.com",
            document_id="",
            target_type="report",
            title="Empty report",
            prompt="",
            page_count=4,
            guidance_item_ids=[],
            source_paths=[],
            source_names=[],
            bound_document_ids=[],
        )

    assert exc_info.value.status_code == 400
    assert "请先选择至少一个来源" in str(exc_info.value.detail)
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pytest fastapi_app/tests/test_source_first_output.py -q
```

Expected: fail because `create_outline()` still raises `document_id is required`.

- [ ] **Step 3: Implement source context helpers and optional document validation**

In `fastapi_app/routers/kb_outputs_v2.py`, make `document_id` default to an empty string:

```python
document_id: str = ""
```

In `fastapi_app/services/output_v2_service.py`, add helper methods near `_normalize_source_names()`:

```python
    def _resolve_output_source_path(self, path_value: str) -> Path:
        from fastapi_app.routers.kb import _resolve_local_path

        return _resolve_local_path(path_value)

    def _extract_output_source_text(self, source_paths: List[str], max_chars: int = 12000) -> str:
        from fastapi_app.routers.kb import _extract_text_from_files

        resolved_paths: List[str] = []
        for raw_path in source_paths or []:
            cleaned = str(raw_path or "").strip()
            if not cleaned:
                continue
            if cleaned.startswith("http://") or cleaned.startswith("https://"):
                continue
            local_path = self._resolve_output_source_path(cleaned)
            if local_path.exists() and local_path.is_file():
                resolved_paths.append(str(local_path))
        if not resolved_paths:
            return ""
        return self._truncate_text(_extract_text_from_files(resolved_paths, max_chars=max_chars), max_chars)

    def _build_source_first_context(
        self,
        *,
        document: Dict[str, Any],
        source_paths: List[str],
        source_names: List[str],
        bound_documents: List[Dict[str, Any]],
        guidance_text: str,
        include_source_text: bool = True,
    ) -> str:
        sections: List[str] = []
        document_content = str(document.get("content") or "").strip()
        if document_content:
            sections.extend(["# 梳理文档", self._truncate_text(document_content, 6000)])
        if source_names or source_paths:
            source_lines = []
            for index, path_value in enumerate(source_paths or []):
                name = source_names[index] if index < len(source_names) else Path(str(path_value)).name
                source_lines.append(f"- {name}: {path_value}")
            sections.extend(["# 来源", "\n".join(source_lines)])
        if include_source_text:
            source_text = self._extract_output_source_text(source_paths, max_chars=12000)
            if source_text:
                sections.extend(["# 来源内容", source_text])
        bound_parts: List[str] = []
        for doc in bound_documents[:4]:
            content = self._truncate_text(str(doc.get("content") or ""), 3000)
            if content:
                bound_parts.append(f"## {doc.get('title') or '参考文档'}\n\n{content}")
        if bound_parts:
            sections.extend(["# 参考文档", "\n\n".join(bound_parts)])
        if str(guidance_text or "").strip():
            sections.extend(["# 产出指导", self._truncate_text(guidance_text, 4000)])
        return "\n\n".join(section for section in sections if str(section or "").strip()).strip()
```

Update `create_outline()`:

```python
        # Delete the old non-PPT document_id hard requirement.
        document = self._maybe_load_document(...)
        ...
        source_context = self._build_source_first_context(
            document=document,
            source_paths=normalized_source_paths,
            source_names=normalized_source_names,
            bound_documents=bound_documents,
            guidance_text=guidance_snapshot_text,
            include_source_text=target_type != "ppt",
        )
        if target_type != "ppt" and not source_context.strip():
            raise HTTPException(
                status_code=400,
                detail="请先选择至少一个来源，或选择一份梳理文档 / 参考文档 / 产出指导。",
            )
```

For non-PPT outline creation, call `_fallback_outline()` with `content=source_context` and `title=title or document.get("title") or normalized_source_names[0] if available`.

- [ ] **Step 4: Run backend tests to verify GREEN**

Run:

```bash
pytest fastapi_app/tests/test_source_first_output.py -q
```

Expected: both tests pass.

## Task 2: Backend Final Generation Uses Source-First Context

**Files:**
- Modify: `fastapi_app/services/output_v2_service.py`
- Modify: `fastapi_app/tests/test_source_first_output.py`

- [ ] **Step 1: Add failing generation markdown test**

Append this test to `fastapi_app/tests/test_source_first_output.py`:

```python
def test_generation_markdown_includes_source_content_without_document(monkeypatch, tmp_path):
    source = tmp_path / "source.md"
    source.write_text("Source-only evidence for downstream generation.", encoding="utf-8")

    service = OutputV2Service()
    item = {
        "title": "Mindmap output",
        "prompt": "",
        "guidance_snapshot_text": "",
        "source_paths": [str(source)],
        "source_names": ["source.md"],
        "bound_document_ids": [],
        "outline": [
            {
                "title": "Source evidence",
                "summary": "Use source evidence",
                "bullets": ["Source-only evidence"],
            }
        ],
    }

    markdown = service._build_generation_markdown(
        item,
        {"id": "", "title": "", "content": ""},
        guidance_text="",
        bound_documents=[],
    )

    assert "## 来源内容" in markdown
    assert "Source-only evidence for downstream generation." in markdown
    assert "## 原始文档" not in markdown
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pytest fastapi_app/tests/test_source_first_output.py::test_generation_markdown_includes_source_content_without_document -q
```

Expected: fail because `_build_generation_markdown()` does not accept `bound_documents` and does not include source content.

- [ ] **Step 3: Update generation markdown and report generation**

Change `_build_generation_markdown()` signature:

```python
    def _build_generation_markdown(
        self,
        item: Dict[str, Any],
        document: Dict[str, Any],
        guidance_text: str = "",
        bound_documents: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
```

Use `_build_source_first_context()` to append source-first context instead of always appending `## 原始文档`.

Change `_generate_report()` signature to accept `bound_documents`, and write the same source-first context after the outline:

```python
        source_context = self._build_source_first_context(
            document=document,
            source_paths=item.get("source_paths") or [],
            source_names=item.get("source_names") or [],
            bound_documents=bound_documents or [],
            guidance_text=cleaned_guidance,
            include_source_text=True,
        )
        if source_context:
            lines.extend(["---", "", source_context])
```

In `generate_output()`, load `bound_documents` from `item["bound_document_ids"]` before generation, pass them to `_generate_report()` and `_build_generation_markdown()`.

- [ ] **Step 4: Run backend tests**

Run:

```bash
pytest fastapi_app/tests/test_source_first_output.py -q
```

Expected: all tests pass.

## Task 3: Frontend Stops Auto-Creating Source-Derived Documents

**Files:**
- Modify: `frontend/src/components/ThinkFlowWorkspace.tsx`
- Modify: `frontend/src/components/DocumentPanelSection.tsx`
- Modify: `frontend/tests/i18n.spec.js`

- [ ] **Step 1: Add Playwright route assertion**

In `frontend/tests/i18n.spec.js`, add a focused test that opens direct output without a document and asserts the outline payload has an empty `document_id` and does not call `/api/v1/kb/chat` for source-derived document generation.

Use the existing route stubbing style from the file. The test should:

- Seed English locale.
- Return one notebook and one source file.
- Return no documents.
- Return no workspace items.
- Intercept `POST /api/v1/kb/outputs/outline`.
- Click a non-PPT output button.
- Confirm the modal.
- Assert `payload.document_id === ""`.
- Assert `payload.source_paths.length === 1`.

- [ ] **Step 2: Run Playwright test to verify RED**

Run:

```bash
cd frontend && npx playwright test tests/i18n.spec.js -g "direct non-PPT output uses sources without auto document"
```

Expected: fail because the current frontend still routes non-PPT output through source-derived document behavior or stale UI text.

- [ ] **Step 3: Update input resolution**

In `frontend/src/components/ThinkFlowWorkspace.tsx`:

- Remove `deferSourceDerivedDocument` from `resolveOutputCreationInputs()` options.
- Stop calling `buildSourceDerivedDocument()` inside `resolveOutputCreationInputs()`.
- For non-PPT without a real active document, leave `outputDocumentId` as `""` and set `outputDocumentTitle` to `resolvedSourceNames[0] || notebookTitle || outputLabel(targetType)`.
- Validate all output types with the same usable context rule: selected sources, non-empty document, bound docs, or guidance.
- Remove `{ deferSourceDerivedDocument: true }` from `openDirectOutputIntent()`.
- Keep `buildSourceDerivedDocument()` only if another caller exists; otherwise delete it.

- [ ] **Step 4: Update UI copy**

In `frontend/src/components/ThinkFlowWorkspace.tsx`, replace direct output empty-document copy with:

```text
当前没有选择梳理文档，本次会直接基于来源和可选参考生成结果。
```

In `frontend/src/components/DocumentPanelSection.tsx`, replace:

```text
优先使用当前梳理文档；如果文档为空，会先基于当前来源自动生成一份来源梳理
```

with:

```text
来源是主输入；当前梳理文档和产出指导会作为可选增强上下文
```

- [ ] **Step 5: Run Playwright test**

Run:

```bash
cd frontend && npx playwright test tests/i18n.spec.js -g "direct non-PPT output uses sources without auto document"
```

Expected: the new test passes.

## Task 4: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run backend targeted tests**

Run:

```bash
pytest fastapi_app/tests/test_source_first_output.py fastapi_app/tests/test_delete_source_cleanup.py -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run frontend smoke tests**

Run:

```bash
cd frontend && npx playwright test tests/i18n.spec.js
```

Expected: all Playwright tests in the file pass.

- [ ] **Step 3: Check git diff**

Run:

```bash
git diff -- fastapi_app/routers/kb_outputs_v2.py fastapi_app/services/output_v2_service.py fastapi_app/tests/test_source_first_output.py frontend/src/components/ThinkFlowWorkspace.tsx frontend/src/components/DocumentPanelSection.tsx frontend/tests/i18n.spec.js docs/superpowers/plans/2026-04-21-source-first-output.md
```

Expected: only source-first output changes are present.

- [ ] **Step 4: Commit source-first output changes**

Commit only the files in this plan:

```bash
git add fastapi_app/routers/kb_outputs_v2.py fastapi_app/services/output_v2_service.py fastapi_app/tests/test_source_first_output.py frontend/src/components/ThinkFlowWorkspace.tsx frontend/src/components/DocumentPanelSection.tsx frontend/tests/i18n.spec.js docs/superpowers/plans/2026-04-21-source-first-output.md
git commit -m "feat: support source-first output generation"
```
