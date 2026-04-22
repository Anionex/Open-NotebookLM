"""Run the kb_mindmap workflow from a specific git worktree on every MD in papers_md/.

Usage:
    python 03_run_algorithm.py --worktree <path> --out <dir> [--only <stem>] [--force]

Imports `workflow_engine` from the worktree's path (via sys.path insertion), so the
same venv can drive either branch. Meant to be run twice — once per worktree.
"""
from __future__ import annotations
import argparse
import asyncio
import os
import shutil
import sys
import time
import traceback
from pathlib import Path

BENCH_DIR = Path(__file__).resolve().parents[1]
MD_DIR = BENCH_DIR / "papers_md"

try:
    from dotenv import load_dotenv
    load_dotenv(BENCH_DIR / ".env", override=False)
except ImportError:
    pass

API_URL = os.getenv("BENCH_GEN_API_URL", "")
API_KEY = os.getenv("BENCH_GEN_API_KEY", "")
MODEL = os.getenv("BENCH_GEN_MODEL", "gemini-3-flash-preview")
LANGUAGE = "zh"
MAX_DEPTH = 6
CONCURRENCY = int(os.getenv("BENCH_GEN_CONCURRENCY", "3"))


async def run_one(md_path: Path, out_md: Path, run_workflow, KBMindMapState, KBMindMapRequest,
                  staging_root: Path, sem: asyncio.Semaphore) -> tuple[str, str]:
    stem = md_path.stem
    async with sem:
        t0 = time.time()
        try:
            request = KBMindMapRequest(
                file_ids=[str(md_path)],
                model=MODEL,
                chat_api_url=API_URL,
                api_key=API_KEY,
                language=LANGUAGE,
                max_depth=MAX_DEPTH,
            )
            if hasattr(request, "email"):
                request.email = "bench"
            if hasattr(request, "chat_api_key"):
                request.chat_api_key = API_KEY

            result_path = staging_root / f"{stem}_{int(t0)}"
            result_path.mkdir(parents=True, exist_ok=True)
            state = KBMindMapState(request=request, result_path=str(result_path))

            await run_workflow("kb_mindmap", state)

            produced = None
            for candidate in ("mindmap.md", "mindmap.mmd"):
                cand = result_path / candidate
                if cand.exists() and cand.stat().st_size > 0:
                    produced = cand
                    break
            if produced is not None:
                shutil.copy(produced, out_md)
                dt = time.time() - t0
                return stem, f"OK ({produced.stat().st_size / 1024:.1f} KB, {dt:.0f}s)"
            return stem, "FAILED: no mindmap output file produced"
        except Exception as e:
            return stem, f"FAILED: {type(e).__name__}: {e}\n{traceback.format_exc()[-400:]}"


async def main_async(args: argparse.Namespace) -> int:
    worktree = Path(args.worktree).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not (worktree / "workflow_engine").exists():
        print(f"ERROR: {worktree}/workflow_engine not found")
        return 1

    # Bind imports to the worktree
    sys.path.insert(0, str(worktree))
    os.chdir(str(worktree))

    from workflow_engine.workflow import run_workflow
    from workflow_engine.state import KBMindMapState, KBMindMapRequest
    # Trigger workflow registration
    from workflow_engine.workflow import wf_kb_mindmap  # noqa: F401

    mds = sorted(MD_DIR.glob("*.md"))
    if args.only:
        mds = [m for m in mds if args.only in m.stem]
    if not mds:
        print("No MD files found")
        return 1

    todo = []
    for md in mds:
        out = out_dir / (md.stem + ".md")
        if out.exists() and out.stat().st_size > 200 and not args.force:
            print(f"skip: {md.stem} (already done)")
            continue
        todo.append((md, out))

    if not todo:
        print("All done; nothing to do.")
        return 0

    print(f"Running {len(todo)} papers on worktree {worktree.name} (concurrency={CONCURRENCY})")
    staging_root = BENCH_DIR / "_staging" / out_dir.name
    staging_root.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = [run_one(md, out, run_workflow, KBMindMapState, KBMindMapRequest, staging_root, sem)
             for md, out in todo]
    results = await asyncio.gather(*tasks)

    ok, fail = 0, 0
    for stem, msg in results:
        print(f"  [{stem}] {msg}")
        if msg.startswith("OK"):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} OK, {fail} failed")
    return 0 if fail == 0 else 1


def main() -> int:
    if not API_URL or not API_KEY:
        print("ERROR: set BENCH_GEN_API_URL and BENCH_GEN_API_KEY (OpenAI-compatible LLM endpoint for generation)")
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--worktree", required=True, help="Path to git worktree")
    parser.add_argument("--out", required=True, help="Output dir for <stem>.md results")
    parser.add_argument("--only", default=None, help="Only process papers whose stem contains this substring (dry run)")
    parser.add_argument("--force", action="store_true", help="Re-generate even if output exists")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
