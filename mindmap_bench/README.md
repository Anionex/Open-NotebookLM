# MindMap Benchmark: MapReduce vs Original

LLM-as-judge comparison of the MapReduce mindmap pipeline (`feat/mindmap-mapreduce`) vs the original single-pass path (`opendcai/thinkflow`) over ~20 research papers.

## Layout

- `papers/` — PDFs (gitignored; download with `01_collect_papers.py`)
- `papers_md/` — MD conversions from mineru (gitignored; regenerate with `02_convert_pdfs.sh`)
- `results/{mapreduce,original,original_md}/` — generated mindmaps (gitignored)
- `scores/` — per-paper judge JSON (gitignored)
- `report_vN.{md,csv,html}` — frozen reports per round (**tracked**)
- `arxiv_ids.txt` — curated paper list
- `scripts/` — the 6-stage pipeline

## Pipeline

```
01_collect_papers.py   → download PDFs from arxiv_ids.txt
02_convert_pdfs.sh     → mineru-open-api extract → papers_md/
03_run_algorithm.py    → run one worktree's kb_mindmap on all MDs
04_judge.py            → gemini-3-pro-preview paired A/B scoring
05_aggregate.py        → report.{md,csv}
06_html_report.py      → report.html (Chart.js)
normalize_format.py    → Mermaid → MD heading normalization (for OG outputs)
```

## Running

Set the env vars (see `.env.example`), create two worktrees pinned to the two branches, then:

```bash
# Generate on each worktree
python scripts/03_run_algorithm.py --worktree .claude/worktrees/bench-mapreduce --out results/mapreduce
python scripts/03_run_algorithm.py --worktree .claude/worktrees/bench-original  --out results/original
python scripts/normalize_format.py  # Mermaid → MD for fair comparison

# Judge + report
python scripts/04_judge.py
python scripts/05_aggregate.py
python scripts/06_html_report.py
```

After each round: `mv report.{md,csv,html} report_v<N>.{md,csv,html}` to freeze it, then commit.

## Versioned rounds

| Round | Change | MR / OG (/25) | Δ | MR win-rate |
|-------|--------|---------------|---|-------------|
| v1 | Initial: MR emits mixed heading+bullet MD; OG emits Mermaid | mixed format, unfair | — | — |
| v2 | Both same model (qwen2.5-14b-Instruct-1m, 1M ctx), full paper fed | 13.90 / 20.60 | -6.70 | — |
| v3 | Switch generator to `gemini-3-flash-preview` (汇云) | 18.45 / 24.40 | -5.95 | 5% |
| v4 | Inject source heading tree as soft reference in Map+Reduce prompts | 19.75 / 23.80 | -4.05 | 20% |

Notes:
- All rounds use `gemini-3-pro-preview` as judge, randomized A/B order per paper.
- MR results are format-normalized (strip code fences); OG results are Mermaid→MD normalized via `normalize_format.py`.
- Full paper content is fed to both paths in v2+ to isolate algorithm from truncation.
