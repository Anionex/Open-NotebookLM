"""Aggregate judge scores into report.csv + report.md.

Reads scores/*.json (produced by 04_judge.py) and produces:
  - mindmap_bench/report.csv  (one row per paper per algo per dim, long format)
  - mindmap_bench/report.md   (human-readable summary: per-dim means, paired wins, etc.)
"""
from __future__ import annotations
import csv
import json
from pathlib import Path
from statistics import mean, pstdev

BENCH_DIR = Path(__file__).resolve().parents[1]
SCORES_DIR = BENCH_DIR / "scores"
REPORT_CSV = BENCH_DIR / "report.csv"
REPORT_MD = BENCH_DIR / "report.md"
DIMENSIONS = ["coverage", "hierarchy", "balance", "conciseness", "accuracy"]
ALGOS = ["mapreduce", "original"]


def load_all() -> list[dict]:
    rows = []
    for p in sorted(SCORES_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not data.get("scores"):
            continue
        mapping = data["mapping"]
        unblinded = {}
        for label in ("A", "B"):
            algo = mapping[f"{label}_is"]
            unblinded[algo] = data["scores"][label]
        rows.append({"stem": data["stem"], "scores": unblinded})
    return rows


def write_csv(rows: list[dict]) -> None:
    with REPORT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["stem", "algo", "dimension", "score"])
        for row in rows:
            for algo in ALGOS:
                for dim in DIMENSIONS:
                    w.writerow([row["stem"], algo, dim, row["scores"][algo][dim]])


def algo_stats(rows: list[dict], algo: str, dim: str) -> tuple[float, float]:
    vals = [r["scores"][algo][dim] for r in rows]
    return mean(vals), pstdev(vals) if len(vals) > 1 else 0.0


def paired_wins(rows: list[dict], dim: str) -> tuple[int, int, int]:
    """(mapreduce_wins, original_wins, ties) on a single dimension."""
    mw = ow = tie = 0
    for r in rows:
        m = r["scores"]["mapreduce"][dim]
        o = r["scores"]["original"][dim]
        if m > o: mw += 1
        elif o > m: ow += 1
        else: tie += 1
    return mw, ow, tie


def overall_wins(rows: list[dict]) -> tuple[int, int, int]:
    """Wins counted by sum across all 5 dims."""
    mw = ow = tie = 0
    for r in rows:
        m = sum(r["scores"]["mapreduce"][d] for d in DIMENSIONS)
        o = sum(r["scores"]["original"][d] for d in DIMENSIONS)
        if m > o: mw += 1
        elif o > m: ow += 1
        else: tie += 1
    return mw, ow, tie


def write_md(rows: list[dict]) -> None:
    n = len(rows)
    lines = [
        "# MindMap Benchmark: MapReduce vs Original",
        "",
        f"- Papers judged: **{n}**",
        "- Generator: `gemini-3-flash-preview` (汇云, full paper fed to both paths)",
        "- Judge: `gemini-3-pro-preview` (aihubmix)",
        "- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)",
        "",
        "## Per-dimension mean ± std",
        "",
        "| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |",
        "|-----------|------------------------|------------------------|-------------|",
    ]
    for dim in DIMENSIONS:
        mm, ms = algo_stats(rows, "mapreduce", dim)
        om, os_ = algo_stats(rows, "original", dim)
        lines.append(f"| {dim} | {mm:.2f} ± {ms:.2f} | {om:.2f} ± {os_:.2f} | {mm - om:+.2f} |")

    mm_total = mean([sum(r["scores"]["mapreduce"][d] for d in DIMENSIONS) for r in rows])
    om_total = mean([sum(r["scores"]["original"][d] for d in DIMENSIONS) for r in rows])
    lines += [
        "",
        f"**Sum of dims** — MapReduce: **{mm_total:.2f}/25**, Original: **{om_total:.2f}/25** (Δ = {mm_total - om_total:+.2f})",
        "",
        "## Paired wins per dimension",
        "",
        "| Dimension | MR wins | OG wins | Tie |",
        "|-----------|---------|---------|-----|",
    ]
    for dim in DIMENSIONS:
        mw, ow, tie = paired_wins(rows, dim)
        lines.append(f"| {dim} | {mw} | {ow} | {tie} |")

    mw, ow, tie = overall_wins(rows)
    lines += [
        "",
        f"**Overall paired result (sum of dims):** MapReduce {mw} / Original {ow} / Tie {tie}  ({mw / n:.0%} MR win-rate)",
        "",
        "## Per-paper scores",
        "",
        "| Paper | MR sum | OG sum | Δ | Winner |",
        "|-------|--------|--------|---|--------|",
    ]
    for r in sorted(rows, key=lambda x: x["stem"]):
        m = sum(r["scores"]["mapreduce"][d] for d in DIMENSIONS)
        o = sum(r["scores"]["original"][d] for d in DIMENSIONS)
        delta = m - o
        if delta > 0: winner = "MR"
        elif delta < 0: winner = "OG"
        else: winner = "tie"
        stem = r["stem"]
        if len(stem) > 60:
            stem = stem[:57] + "..."
        lines.append(f"| {stem} | {m} | {o} | {delta:+d} | {winner} |")

    lines += [
        "",
        "## Strong wins (Δ ≥ 3)",
        "",
    ]
    strong = []
    for r in rows:
        m = sum(r["scores"]["mapreduce"][d] for d in DIMENSIONS)
        o = sum(r["scores"]["original"][d] for d in DIMENSIONS)
        if abs(m - o) >= 3:
            strong.append((r["stem"], m, o, m - o))
    if strong:
        for stem, m, o, d in sorted(strong, key=lambda x: -abs(x[3])):
            side = "MR" if d > 0 else "OG"
            lines.append(f"- **{side}** +{abs(d)} on `{stem}` (MR={m}, OG={o})")
    else:
        lines.append("_None — all deltas < 3._")

    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    rows = load_all()
    if not rows:
        print("No scores found in scores/. Run 04_judge.py first.")
        return 1
    write_csv(rows)
    write_md(rows)
    print(f"Wrote {REPORT_CSV} and {REPORT_MD} ({len(rows)} papers)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
