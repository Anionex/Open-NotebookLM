"""LLM-as-judge for mindmap comparison.

For every paper that has BOTH results (results/mapreduce/<stem>.md and results/original/<stem>.md):
  - Randomly assign mapreduce/original to labels A/B
  - Send source MD + both mindmaps to gemini-3-pro-preview via aihubmix
  - Ask for 1-5 scores across 5 dimensions (Coverage, Hierarchy, Balance, Conciseness, Accuracy)
  - Save to scores/<stem>.json with the A/B mapping so we can unblind later

Robust to malformed JSON (regex fallback), retries transient errors twice.
"""
from __future__ import annotations
import argparse
import asyncio
import json
import random
import re
import sys
import time
from pathlib import Path
from typing import Any

import os

import httpx

BENCH_DIR = Path(__file__).resolve().parents[1]
MD_DIR = BENCH_DIR / "papers_md"

try:
    from dotenv import load_dotenv
    load_dotenv(BENCH_DIR / ".env", override=False)
except ImportError:
    pass

RESULTS = {
    "mapreduce": BENCH_DIR / "results" / "mapreduce",
    "original": BENCH_DIR / "results" / "original_md",  # format-normalized (Mermaid → MD headings)
}
SCORES_DIR = BENCH_DIR / "scores"

JUDGE_MODEL = os.getenv("BENCH_JUDGE_MODEL", "gemini-3-pro-preview")
API_URL = os.getenv("BENCH_JUDGE_API_URL", "https://aihubmix.com/v1/chat/completions")
API_KEY = os.getenv("BENCH_JUDGE_API_KEY", "")
DIMENSIONS = ["coverage", "hierarchy", "balance", "conciseness", "accuracy"]
SOURCE_CHAR_CAP = 180000  # plenty of room for gemini-3-pro's long context

CONCURRENCY = int(os.getenv("BENCH_JUDGE_CONCURRENCY", "4"))
MAX_RETRIES = 2


def load_paper_set(results: dict[str, Path] | None = None) -> list[tuple[str, Path, Path, Path]]:
    """Return list of (stem, source_md, algo_a_md, algo_b_md) for papers with both results."""
    results = results or RESULTS
    algo_names = list(results.keys())
    out = []
    for src in sorted(MD_DIR.glob("*.md")):
        stem = src.stem
        a = results[algo_names[0]] / f"{stem}.md"
        b = results[algo_names[1]] / f"{stem}.md"
        if a.exists() and b.exists():
            out.append((stem, src, a, b))
    return out


def build_prompt(source_md: str, mindmap_a: str, mindmap_b: str) -> str:
    if len(source_md) > SOURCE_CHAR_CAP:
        source_md = source_md[:SOURCE_CHAR_CAP] + "\n\n[...truncated for length]"
    return f"""你是思维导图质量评审员。下面给你一篇论文的 Markdown 全文，以及两份由不同算法生成的思维导图 A 与 B。两份均已统一为 Markdown 标题树格式（#/##/###…），格式已完全一致，请只评估内容与结构质量。请客观对比后为每一份分别打分。

评分维度（各 1-5 分，5 最佳）：
- coverage (全文覆盖): 是否完整覆盖论文的主要章节与主题
- hierarchy (层级合理性): 父子关系是否合理、深度利用是否充分
- balance (分支均衡性): 各主分支规模是否均衡，无某一分支独大/饥饿
- conciseness (简洁性): 节点用短语而非长句，无括号补充或冗词
- accuracy (忠实度): 论文中的关键术语、数字、论点是否准确保留

输出严格 JSON（不得含 Markdown 代码围栏或任何解释文字）。输出格式：
{{
  "A": {{"coverage": int, "hierarchy": int, "balance": int, "conciseness": int, "accuracy": int, "rationale": "..."}},
  "B": {{"coverage": int, "hierarchy": int, "balance": int, "conciseness": int, "accuracy": int, "rationale": "..."}}
}}

[SOURCE MARKDOWN]
{source_md}

[MINDMAP A]
{mindmap_a}

[MINDMAP B]
{mindmap_b}

请直接输出 JSON："""


def parse_scores(raw: str) -> dict | None:
    """Best-effort JSON parse with regex fallback."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


def validate_scores(obj: Any) -> bool:
    if not isinstance(obj, dict):
        return False
    for label in ("A", "B"):
        if label not in obj or not isinstance(obj[label], dict):
            return False
        for dim in DIMENSIONS:
            v = obj[label].get(dim)
            if not isinstance(v, (int, float)) or not (1 <= v <= 5):
                return False
    return True


async def call_judge(client: httpx.AsyncClient, prompt: str) -> tuple[dict | None, str]:
    """Returns (parsed_scores_or_None, raw_response)."""
    payload = {
        "model": JUDGE_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_completion_tokens": 3000,
    }
    last_raw = ""
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = await client.post(
                API_URL,
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=180,
            )
            r.raise_for_status()
            data = r.json()
            content = data["choices"][0]["message"]["content"]
            last_raw = content
            parsed = parse_scores(content)
            if validate_scores(parsed):
                return parsed, content
        except Exception as e:
            last_raw = f"[exception: {e}]"
        await asyncio.sleep(2 * (attempt + 1))
    return None, last_raw


async def judge_one(stem: str, src: Path, a_path: Path, b_path: Path,
                    client: httpx.AsyncClient, sem: asyncio.Semaphore, force: bool,
                    algo_a_name: str = "mapreduce", algo_b_name: str = "original",
                    scores_dir: Path | None = None) -> tuple[str, str]:
    scores_dir = scores_dir or SCORES_DIR
    out = scores_dir / f"{stem}.json"
    if out.exists() and not force:
        return stem, "skip (already scored)"

    async with sem:
        rng = random.Random(hash(stem) & 0xFFFFFFFF)
        if rng.random() < 0.5:
            a_algo, a_md = algo_a_name, a_path.read_text(encoding="utf-8")
            b_algo, b_md = algo_b_name, b_path.read_text(encoding="utf-8")
        else:
            a_algo, a_md = algo_b_name, b_path.read_text(encoding="utf-8")
            b_algo, b_md = algo_a_name, a_path.read_text(encoding="utf-8")

        source = src.read_text(encoding="utf-8")
        prompt = build_prompt(source, a_md, b_md)
        t0 = time.time()
        parsed, raw = await call_judge(client, prompt)
        dt = time.time() - t0

        payload = {
            "stem": stem,
            "mapping": {"A_is": a_algo, "B_is": b_algo},
            "judge_model": JUDGE_MODEL,
            "scores": parsed,
            "raw_response": None if parsed else raw,
            "elapsed_s": round(dt, 1),
        }
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if parsed:
            a_sum = sum(parsed["A"][d] for d in DIMENSIONS)
            b_sum = sum(parsed["B"][d] for d in DIMENSIONS)
            return stem, f"OK A_is={a_algo} (sum {a_sum}) vs B_is={b_algo} (sum {b_sum}) [{dt:.0f}s]"
        return stem, f"FAILED to parse scores [{dt:.0f}s]"


async def main_async(args: argparse.Namespace) -> int:
    algo_a_name = getattr(args, "algo_a_name", "mapreduce")
    algo_b_name = getattr(args, "algo_b_name", "original")
    results_dict = {
        algo_a_name: Path(args.algo_a_dir) if getattr(args, "algo_a_dir", None) else RESULTS["mapreduce"],
        algo_b_name: Path(args.algo_b_dir) if getattr(args, "algo_b_dir", None) else RESULTS["original"],
    }
    scores_dir = Path(args.scores_dir) if getattr(args, "scores_dir", None) else SCORES_DIR
    scores_dir.mkdir(parents=True, exist_ok=True)

    papers = load_paper_set(results_dict)
    if not papers:
        print("No papers have both results yet.")
        return 1
    if args.only:
        papers = [p for p in papers if args.only in p[0]]
    print(f"Judging {len(papers)} papers with {JUDGE_MODEL} ({algo_a_name} vs {algo_b_name})")

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        tasks = [
            judge_one(stem, src, a, b, client, sem, args.force, algo_a_name, algo_b_name, scores_dir)
            for stem, src, a, b in papers
        ]
        results = await asyncio.gather(*tasks)

    ok = sum(1 for _, msg in results if msg.startswith("OK"))
    skip = sum(1 for _, msg in results if msg.startswith("skip"))
    fail = len(results) - ok - skip
    for stem, msg in results:
        print(f"  [{stem}] {msg}")
    print(f"\nDone: {ok} OK, {skip} skipped, {fail} failed")
    return 0 if fail == 0 else 1


def main() -> int:
    if not API_KEY:
        print("ERROR: set BENCH_JUDGE_API_KEY (OpenAI-compatible endpoint serving gemini-3-pro-preview)")
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=None, help="Only judge papers whose stem contains this substring")
    parser.add_argument("--force", action="store_true", help="Re-judge papers that already have scores")
    parser.add_argument("--algo-a-dir", default=None, help="Dir for algo A results (default: results/mapreduce)")
    parser.add_argument("--algo-a-name", default="mapreduce", help="Name for algo A (default: mapreduce)")
    parser.add_argument("--algo-b-dir", default=None, help="Dir for algo B results (default: results/original_md)")
    parser.add_argument("--algo-b-name", default="original", help="Name for algo B (default: original)")
    parser.add_argument("--scores-dir", default=None, help="Dir to write scores JSON (default: scores/)")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
