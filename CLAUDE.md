# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-NotebookLM is an AI-powered knowledge management system. Users upload documents into notebooks, then interact via RAG chat, generate PPTs, mindmaps, podcasts, flashcards, quizzes, and notes from their knowledge base. Supports optional Supabase auth with per-user data isolation; runs in trial mode without it.

## Architecture

**Monorepo with three main components:**

- **`fastapi_app/`** — Python FastAPI backend (port 8213). Handles document parsing, RAG, content generation, auth proxy, and orchestrates local ML services (embedding, TTS).
- **`frontend_en/`** — React 18 + TypeScript + Vite frontend (port 3000). Vite proxies `/api` and `/outputs` to the backend. There is a parallel `frontend_zh/` for Chinese.
- **`workflow_engine/`** — DataFlow-Agent workflow orchestration. Complex multi-step pipelines (PPT generation, podcast scripts, mindmaps) run as graph-based workflows with agent roles.

**Key architectural patterns:**
- Frontend never talks to Supabase directly — all auth goes through backend proxy (`/api/v1/auth/*`)
- No client-side routing library; `App.tsx` manages view state (`dashboard` | `notebook`) and tool switching within `NotebookView`
- User data isolated by email: `outputs/kb_data/{sanitized_email}/{notebook_id}/`
- Backend config uses Pydantic BaseSettings (`fastapi_app/config/settings.py`) with `.env` → `.env.local` override chain
- LLM calls use OpenAI-compatible API format (works with DeepSeek, OpenAI, Ollama, etc.)
- Three-layer model config: base settings → workflow-level → per-role override

**Backend router → service → workflow flow:**
- `routers/kb.py` — Knowledge base CRUD, file upload, RAG chat (streaming), conversation history
- `routers/paper2ppt.py` → `services/paper2ppt_service.py` → `workflow_engine/workflow/wf_paper2ppt_parallel_consistent_style.py`
- Similar pattern for drawio, flashcards, quiz, podcast, mindmap

**Frontend state:**
- Zustand store (`stores/authStore.ts`) for auth
- localStorage for API settings (`services/apiSettingsService.ts`) and client-side fetch cache (`services/clientCache.ts`)

## Development Commands

### Frontend (`frontend_en/`)
```bash
cd frontend_en && npm install    # Install dependencies
cd frontend_en && npm run dev    # Dev server on port 3000 (proxies to backend)
cd frontend_en && npm run build  # tsc + vite build
```

### Backend
```bash
# From project root:
uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload
```
The backend auto-launches local embedding (port 26210) and TTS (port 26211) if configured in `.env`.

### Full stack (production-style)
```bash
./scripts/start.sh   # Starts backend + frontend_zh + monitor
./scripts/stop.sh    # Stops all services
```

### Python dependencies
```bash
# Full (needs GPU deps resolved):
pip install -r requirements-base.txt

# Minimal (no torch/vllm/paddle, sufficient for mindmap/chat/most features):
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -r requirements-minimal.txt
```

### Quick start (local dev, no GPU)
```bash
# 1. Backend (must run from project root)
source .venv/bin/activate
python -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload

# 2. Frontend
cd frontend_en && npm install && npm run dev

# 3. Open in browser
open -a "Microsoft Edge" http://localhost:3000
```

## Environment Configuration

Backend env files live in `fastapi_app/`. `.env` is base config; `.env.local` overrides it.

**Required:** `DEFAULT_LLM_API_URL` — any OpenAI-compatible endpoint.

**Optional:** `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` for auth (without these, runs in trial mode). `SERPER_API_KEY` for web search. `USE_LOCAL_EMBEDDING=1` / `USE_LOCAL_TTS=1` for local ML services with GPU assignment via `LOCAL_*_CUDA_VISIBLE_DEVICES`.

See `fastapi_app/.env.example` for the full reference.

## User Preferences

- Browser: Microsoft Edge (use `open -a "Microsoft Edge"` for previews)

## MindMap-MapReduce Pipeline

**File:** `workflow_engine/workflow/wf_kb_mindmap.py` (~770 lines)  
**State:** `workflow_engine/state.py` → `KBMindMapState`

**Two execution paths, routed by token count:**

```
                          ┌── [短文本] → generate_single_pass ──┐
_start_ → parse_files → chunk_and_route ─┤                                      ├→ save_and_end → _end_
                          └── [长文本] → map_phase → collapse_phase ⟲ → reduce_phase ──┘
```

**Routing threshold:** total content tokens vs `model_context_window × 0.4`. E.g. deepseek-v3.2 (128K) → limit ~51K tokens.

**Short-text path** (`generate_single_pass`): Concatenate all file content → single LLM call → Markdown heading mindmap.

**Long-text MapReduce path:**

| Phase | Node | What it does |
|-------|------|-------------|
| Parse | `parse_files` | Extract text from PDF/DOCX/PPTX/TXT (no truncation) |
| Route | `chunk_and_route` | tiktoken token count → decide path; split with `RecursiveCharacterTextSplitter` |
| Map | `map_phase` | **Parallel** LLM calls per chunk → 5-20 JSON knowledge nodes each (topic, parent_topic, summary, importance_score 1-5) |
| Collapse | `collapse_phase` | Iterative pairwise merge: dedup, build hierarchy, re-score, prune score≤1 nodes. Loops until tokens ≤ limit or 5 rounds |
| Reduce | `reduce_phase` | Merged JSON nodes → LLM → final Markdown heading mindmap (# ## ### ####) |

**Key helper functions:**
- `_get_context_window(model)` (line 84): model context window lookup, longest-key-match
- `_count_tokens(text, model)` (line 49): tiktoken-based, fallback `len/3`
- `_parse_json_safe(raw, chunk_id)` (line 101): 3-strategy JSON parse with fallback node
- `_clean_markdown_output(raw)` (line 150): strip code fences from LLM output

**Prompt templates** (lines 171-340): `_build_single_pass_prompt`, `_build_map_prompt`, `_build_collapse_prompt`, `_build_reduce_prompt`

**API endpoint:** `POST /api/v1/kb/generate-mindmap` in `fastapi_app/routers/kb.py:2493`  
**Internal API key:** `X-API-Key: df-internal-2024-workflow-key`

## Important Conventions

- Comments and log messages in the backend/workflow engine are often in Chinese
- `kb.py` and `NotebookView.tsx` are very large files (~130KB+ and ~180KB+) — read specific sections rather than the whole file
- The `frontend_en/` and `frontend_zh/` codebases are maintained in parallel; changes to one should be mirrored in the other
- Workflow definitions in `workflow_engine/workflow/` follow a naming convention: `wf_*.py`
- API key middleware (`fastapi_app/middleware/api_key.py`) validates all non-auth requests
