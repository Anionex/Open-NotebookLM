"""Collect ~20 papers for the mindmap benchmark.

Reads optional `mindmap_bench/arxiv_ids.txt` for explicitly-curated IDs,
then searches arxiv for related queries to fill up to TARGET_TOTAL.
Skips PDFs already present in papers/.
"""
from __future__ import annotations
import re
import sys
import time
from pathlib import Path

import arxiv

BENCH_DIR = Path(__file__).resolve().parents[1]
PAPERS_DIR = BENCH_DIR / "papers"
IDS_FILE = BENCH_DIR / "arxiv_ids.txt"

TARGET_TOTAL = 20

QUERIES = [
    "slide deck generation LLM",
    "paper to presentation agent",
    "text to slides neural",
    "mind map generation LLM",
    "document hierarchical summarization tree",
    "presentation slides evaluation benchmark",
    "knowledge graph construction from scientific paper",
    "outline generation from long document",
]

_SLUG_RE = re.compile(r"[^\w\-]+")


def slugify(title: str, max_len: int = 90) -> str:
    s = _SLUG_RE.sub("_", title).strip("_")
    return s[:max_len]


def existing_pdfs() -> list[Path]:
    return sorted(PAPERS_DIR.glob("*.pdf"))


def load_curated_ids() -> list[str]:
    if not IDS_FILE.exists():
        return []
    ids: list[str] = []
    for line in IDS_FILE.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            ids.append(line)
    return ids


def already_have(arxiv_id: str, title: str, existing: list[Path]) -> bool:
    for p in existing:
        stem_lower = p.stem.lower()
        if arxiv_id.replace(".", "_") in stem_lower:
            return True
        title_slug = slugify(title).lower()
        # existing user PDFs are prefixed with a number, e.g. "1_PPTAgent_..."
        # compare core tokens (first 30 chars of title slug vs stem)
        if title_slug[:30] and title_slug[:30] in stem_lower:
            return True
    return False


def download_paper(result: arxiv.Result, prefix: int) -> Path | None:
    pid = result.get_short_id()
    title_slug = slugify(result.title)
    filename = f"{prefix:02d}_{pid}_{title_slug}.pdf"
    out_path = PAPERS_DIR / filename
    if out_path.exists():
        print(f"  already downloaded: {filename}")
        return out_path
    try:
        result.download_pdf(dirpath=str(PAPERS_DIR), filename=filename)
        print(f"  downloaded: {filename}")
        return out_path
    except Exception as e:
        print(f"  FAILED {pid}: {e}")
        return None


def main() -> int:
    PAPERS_DIR.mkdir(parents=True, exist_ok=True)
    existing = existing_pdfs()
    print(f"Existing PDFs: {len(existing)}")

    client = arxiv.Client(page_size=20, delay_seconds=3, num_retries=3)
    downloaded = list(existing)
    seen_ids: set[str] = set()

    # 1) curated IDs (if any)
    curated = load_curated_ids()
    if curated:
        print(f"Trying {len(curated)} curated IDs")
        search = arxiv.Search(id_list=curated)
        for result in client.results(search):
            pid = result.get_short_id()
            seen_ids.add(pid)
            if already_have(pid, result.title, existing):
                continue
            if len(downloaded) >= TARGET_TOTAL:
                break
            prefix = len(downloaded) + 1
            p = download_paper(result, prefix)
            if p:
                downloaded.append(p)

    # 2) fill via queries
    for query in QUERIES:
        if len(downloaded) >= TARGET_TOTAL:
            break
        print(f"Searching: {query!r}")
        search = arxiv.Search(
            query=query,
            max_results=15,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        for result in client.results(search):
            if len(downloaded) >= TARGET_TOTAL:
                break
            pid = result.get_short_id()
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            if already_have(pid, result.title, existing + downloaded):
                continue
            prefix = len(downloaded) + 1
            p = download_paper(result, prefix)
            if p:
                downloaded.append(p)
            time.sleep(0.5)

    print(f"\nTotal PDFs now: {len(downloaded)} (target {TARGET_TOTAL})")
    if len(downloaded) < TARGET_TOTAL:
        print("WARNING: did not reach target — rerun or edit arxiv_ids.txt")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
