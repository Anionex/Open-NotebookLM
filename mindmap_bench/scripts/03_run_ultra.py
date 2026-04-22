"""Run ultra_mindmap on all papers in papers_md/ and save mindmap.md to --out dir.

Usage:
    python 03_run_ultra.py --out results/ultra [--only <stem>] [--force]

Reads BENCH_GEN_API_URL / BENCH_GEN_API_KEY / BENCH_GEN_MODEL from mindmap_bench/.env.
Requires ultra_mindmap installed: uv pip install -e <project_path>
"""
from __future__ import annotations

import argparse
import asyncio
import os
import shutil
import sys
import time
from pathlib import Path

import re

BENCH_DIR = Path(__file__).resolve().parents[1]
MD_DIR = BENCH_DIR / "papers_md"
PYTHON = Path(sys.executable)

KIND_TAG = re.compile(r"\s*\[(root|skeleton|info)\]\s*$")


def normalize_ultra_md(text: str) -> str:
    """Convert ultra_mindmap `- Title [kind]` list format to `# heading` tree format."""
    lines = text.splitlines()
    out: list[str] = []
    for ln in lines:
        if not ln.strip() or not ln.strip().startswith("-"):
            continue
        indent = len(ln) - len(ln.lstrip(" "))
        depth = indent // 2  # 2 spaces per level
        raw = ln.strip().lstrip("- ").strip()
        title = KIND_TAG.sub("", raw).strip()
        if not title:
            continue
        level = min(6, depth + 1)
        out.append("#" * level + " " + title)
    return "\n".join(out) + "\n"

try:
    from dotenv import load_dotenv
    load_dotenv(BENCH_DIR / ".env", override=False)
except ImportError:
    pass

API_URL = os.getenv("BENCH_GEN_API_URL", "")
API_KEY = os.getenv("BENCH_GEN_API_KEY", "")
MODEL = os.getenv("BENCH_GEN_MODEL", "gemini-3-flash-preview")
CONCURRENCY = int(os.getenv("BENCH_GEN_CONCURRENCY", "5"))


async def run_one(
    md_path: Path,
    out_md: Path,
    staging: Path,
    sem: asyncio.Semaphore,
) -> tuple[str, str]:
    stem = md_path.stem
    async with sem:
        t0 = time.time()
        out_dir = staging / stem
        out_dir.mkdir(parents=True, exist_ok=True)

        env = {
            **os.environ,
            "OPENAI_BASE_URL": API_URL,
            "OPENAI_API_KEY": API_KEY,
            "OPENAI_MODEL": MODEL,
            "MINDMAP_JSON_MODE": "json_object",  # safer for non-OpenAI proxies
        }

        proc = await asyncio.create_subprocess_exec(
            str(PYTHON), "-m", "ultra_mindmap.cli",
            "--input", str(md_path),
            "--output-dir", str(out_dir),
            "--chunk-size", "8000",
            "--overlap", "400",
            "--model", MODEL,
            "--base-url", API_URL,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        result_md = out_dir / "mindmap.md"
        if result_md.exists() and result_md.stat().st_size > 100:
            normalized = normalize_ultra_md(result_md.read_text(encoding="utf-8"))
            out_md.write_text(normalized, encoding="utf-8")
            dt = time.time() - t0
            return stem, f"OK ({result_md.stat().st_size / 1024:.1f} KB, {dt:.0f}s)"

        err_snippet = stderr.decode(errors="replace")[-300:] if stderr else ""
        out_snippet = stdout.decode(errors="replace")[-200:] if stdout else ""
        return stem, f"FAILED (rc={proc.returncode})\n  stderr: {err_snippet}\n  stdout: {out_snippet}"


async def main_async(args: argparse.Namespace) -> int:
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    mds = sorted(MD_DIR.glob("*.md"))
    if args.only:
        mds = [m for m in mds if args.only in m.stem]
    if not mds:
        print("No MD files found in", MD_DIR)
        return 1

    todo = []
    for md in mds:
        out = out_dir / (md.stem + ".md")
        if out.exists() and out.stat().st_size > 200 and not args.force:
            print(f"skip: {md.stem}")
            continue
        todo.append((md, out))

    if not todo:
        print("All done; nothing to do.")
        return 0

    print(f"Running ultra_mindmap on {len(todo)} papers (concurrency={CONCURRENCY})")
    staging = BENCH_DIR / "_staging" / "ultra"
    staging.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = [run_one(md, out, staging, sem) for md, out in todo]
    results = await asyncio.gather(*tasks)

    ok = fail = 0
    for stem, msg in results:
        print(f"  [{stem}] {msg[:120]}")
        if msg.startswith("OK"):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} OK, {fail} failed")
    return 0 if fail == 0 else 1


def main() -> int:
    if not API_URL or not API_KEY:
        print("ERROR: set BENCH_GEN_API_URL and BENCH_GEN_API_KEY in mindmap_bench/.env")
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="Output dir for <stem>.md results")
    parser.add_argument("--only", default=None, help="Only process papers whose stem contains this substring")
    parser.add_argument("--force", action="store_true", help="Re-generate even if output exists")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
