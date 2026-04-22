"""Run the current main-repo ultra_mindmap algorithm on all papers_md/*.md.

Usage:
    python scripts/03_run_mainrepo.py \
      --repo /Users/davidyang/ultra_mindmap \
      --out results/mainrepo \
      [--only <stem>] [--force] [--concurrency 1] [--chunk-size 10000]

The current main repo is a lightweight project that exposes `mindmap_core.generate_mindmap`.
This runner imports that module directly, feeds each paper markdown as a single input file,
and converts the returned JSON tree into pure Markdown heading format so it is directly
compatible with the benchmark judge.
"""
from __future__ import annotations

import argparse
import asyncio
import os
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


def tree_to_heading_markdown(node: dict, depth: int = 1) -> str:
    """Convert JSON tree into pure heading markdown for fair judge comparison."""
    topic = str(node.get("topic") or "Untitled").strip()
    if not topic:
        topic = "Untitled"
    lines = [f"{'#' * min(depth, 6)} {topic}"]
    for child in node.get("children", []) or []:
        lines.append(tree_to_heading_markdown(child, depth + 1))
    return "\n".join(lines)


def load_generator(repo: Path):
    # The bench endpoint is reachable directly from this machine, while the local
    # shell often inherits a dev proxy that can stall long LLM requests.
    for key in (
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
    ):
        os.environ.pop(key, None)
    sys.path.insert(0, str(repo))
    os.environ["OPENAI_BASE_URL"] = API_URL
    os.environ["OPENAI_API_KEY"] = API_KEY
    from mindmap_core import generate_mindmap

    return generate_mindmap


async def run_one(
    md_path: Path,
    out_md: Path,
    sem: asyncio.Semaphore,
    generate_mindmap,
    chunk_size: int,
    chunk_overlap: int,
) -> tuple[str, str]:
    stem = md_path.stem
    async with sem:
        t0 = time.time()
        try:
            result = await asyncio.to_thread(
                generate_mindmap,
                [str(md_path)],
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                model=MODEL,
            )
            markdown = tree_to_heading_markdown(result).strip() + "\n"
            out_md.write_text(markdown, encoding="utf-8")
            dt = time.time() - t0
            return stem, f"OK ({len(markdown) / 1024:.1f} KB, {dt:.0f}s)"
        except Exception as e:
            return stem, f"FAILED: {type(e).__name__}: {e}\n{traceback.format_exc()[-500:]}"


async def main_async(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not (repo / "mindmap_core.py").exists():
        print(f"ERROR: {repo}/mindmap_core.py not found")
        return 1
    if not API_URL or not API_KEY:
        print("ERROR: set BENCH_GEN_API_URL and BENCH_GEN_API_KEY in mindmap_bench/.env")
        return 2

    generate_mindmap = load_generator(repo)

    mds = sorted(MD_DIR.glob("*.md"))
    if args.only:
        mds = [m for m in mds if args.only in m.stem]
    if not mds:
        print(f"No MD files found in {MD_DIR}")
        return 1

    todo = []
    for md in mds:
        out = out_dir / f"{md.stem}.md"
        if out.exists() and out.stat().st_size > 200 and not args.force:
            print(f"skip: {md.stem}")
            continue
        todo.append((md, out))

    if not todo:
        print("All done; nothing to do.")
        return 0

    print(
        f"Running current main-repo algorithm on {len(todo)} papers "
        f"(model={MODEL}, chunk_size={args.chunk_size}, chunk_overlap={args.chunk_overlap}, "
        f"concurrency={args.concurrency})"
    )

    sem = asyncio.Semaphore(args.concurrency)
    tasks = [
        run_one(md, out, sem, generate_mindmap, args.chunk_size, args.chunk_overlap)
        for md, out in todo
    ]
    results = await asyncio.gather(*tasks)

    ok = fail = 0
    for stem, msg in results:
        print(f"  [{stem}] {msg}")
        if msg.startswith("OK"):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} OK, {fail} failed")
    return 0 if fail == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="Path to the current main repo")
    parser.add_argument("--out", required=True, help="Output dir for <stem>.md results")
    parser.add_argument("--only", default=None, help="Only process papers whose stem contains this substring")
    parser.add_argument("--force", action="store_true", help="Re-generate even if output exists")
    parser.add_argument("--concurrency", type=int, default=1, help="Number of papers to run in parallel")
    parser.add_argument("--chunk-size", type=int, default=10000, help="Chunk size for current algorithm")
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=1000,
        help="Chunk overlap for current algorithm",
    )
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
