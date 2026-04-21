"""Aggregate judge scores into report.csv + report.md.

Reads scores/*.json (produced by 04_judge.py) and produces:
  - mindmap_bench/report.csv  (one row per paper per algo per dim, long format)
  - mindmap_bench/report.md   (human-readable summary: per-dim means, paired wins, etc.)
"""
from __future__ import annotations
import argparse
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


def load_all(scores_dir: Path) -> list[dict]:
    rows = []
    for p in sorted(scores_dir.glob("*.json")):
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


def write_csv(rows: list[dict], algos: list[str], report_csv: Path) -> None:
    with report_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["stem", "algo", "dimension", "score"])
        for row in rows:
            for algo in algos:
                for dim in DIMENSIONS:
                    if algo in row["scores"]:
                        w.writerow([row["stem"], algo, dim, row["scores"][algo][dim]])


def algo_stats(rows: list[dict], algo: str, dim: str) -> tuple[float, float]:
    vals = [r["scores"][algo][dim] for r in rows if algo in r["scores"]]
    if not vals:
        return 0.0, 0.0
    return mean(vals), pstdev(vals) if len(vals) > 1 else 0.0


def paired_wins(rows: list[dict], dim: str, algo_a: str, algo_b: str) -> tuple[int, int, int]:
    aw = bw = tie = 0
    for r in rows:
        if algo_a not in r["scores"] or algo_b not in r["scores"]:
            continue
        a = r["scores"][algo_a][dim]
        b = r["scores"][algo_b][dim]
        if a > b: aw += 1
        elif b > a: bw += 1
        else: tie += 1
    return aw, bw, tie


def overall_wins(rows: list[dict], algo_a: str, algo_b: str) -> tuple[int, int, int]:
    aw = bw = tie = 0
    for r in rows:
        if algo_a not in r["scores"] or algo_b not in r["scores"]:
            continue
        a = sum(r["scores"][algo_a][d] for d in DIMENSIONS)
        b = sum(r["scores"][algo_b][d] for d in DIMENSIONS)
        if a > b: aw += 1
        elif b > a: bw += 1
        else: tie += 1
    return aw, bw, tie


def write_md(rows: list[dict], algo_a: str, algo_b: str, report_md: Path) -> None:
    n = len(rows)
    la, lb = algo_a.upper(), algo_b.upper()
    lines = [
        f"# MindMap Benchmark: {algo_a} vs {algo_b}",
        "",
        f"- Papers judged: **{n}**",
        "- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)",
        "",
        "## Per-dimension mean ± std",
        "",
        f"| Dimension | {algo_a} (mean ± std) | {algo_b} (mean ± std) | Δ ({la} − {lb}) |",
        "|-----------|------------------|------------------|------------------|",
    ]
    for dim in DIMENSIONS:
        am, as_ = algo_stats(rows, algo_a, dim)
        bm, bs_ = algo_stats(rows, algo_b, dim)
        lines.append(f"| {dim} | {am:.2f} ± {as_:.2f} | {bm:.2f} ± {bs_:.2f} | {am - bm:+.2f} |")

    a_total = mean([sum(r["scores"][algo_a][d] for d in DIMENSIONS) for r in rows if algo_a in r["scores"]])
    b_total = mean([sum(r["scores"][algo_b][d] for d in DIMENSIONS) for r in rows if algo_b in r["scores"]])
    lines += [
        "",
        f"**Sum of dims** — {algo_a}: **{a_total:.2f}/25**, {algo_b}: **{b_total:.2f}/25** (Δ = {a_total - b_total:+.2f})",
        "",
        "## Paired wins per dimension",
        "",
        f"| Dimension | {algo_a} wins | {algo_b} wins | Tie |",
        "|-----------|---------|---------|-----|",
    ]
    for dim in DIMENSIONS:
        aw, bw, tie = paired_wins(rows, dim, algo_a, algo_b)
        lines.append(f"| {dim} | {aw} | {bw} | {tie} |")

    aw, bw, tie = overall_wins(rows, algo_a, algo_b)
    lines += [
        "",
        f"**Overall paired result (sum of dims):** {algo_a} {aw} / {algo_b} {bw} / Tie {tie}  ({aw / n:.0%} {algo_a} win-rate)",
        "",
        "## Per-paper scores",
        "",
        f"| Paper | {algo_a} sum | {algo_b} sum | Δ | Winner |",
        "|-------|--------|--------|---|--------|",
    ]
    for r in sorted(rows, key=lambda x: x["stem"]):
        if algo_a not in r["scores"] or algo_b not in r["scores"]:
            continue
        a = sum(r["scores"][algo_a][d] for d in DIMENSIONS)
        b = sum(r["scores"][algo_b][d] for d in DIMENSIONS)
        delta = a - b
        winner = algo_a if delta > 0 else (algo_b if delta < 0 else "tie")
        stem = r["stem"]
        if len(stem) > 60:
            stem = stem[:57] + "..."
        lines.append(f"| {stem} | {a} | {b} | {delta:+d} | {winner} |")

    lines += ["", "## Strong wins (Δ ≥ 3)", ""]
    strong = []
    for r in rows:
        if algo_a not in r["scores"] or algo_b not in r["scores"]:
            continue
        a = sum(r["scores"][algo_a][d] for d in DIMENSIONS)
        b = sum(r["scores"][algo_b][d] for d in DIMENSIONS)
        if abs(a - b) >= 3:
            strong.append((r["stem"], a, b, a - b))
    if strong:
        for stem, a, b, d in sorted(strong, key=lambda x: -abs(x[3])):
            side = algo_a if d > 0 else algo_b
            lines.append(f"- **{side}** +{abs(d)} on `{stem}` ({algo_a}={a}, {algo_b}={b})")
    else:
        lines.append("_None — all deltas < 3._")

    report_md.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scores-dir", default=None, help="Dir with score JSONs (default: scores/)")
    parser.add_argument("--algo-a", default="mapreduce", help="Name of algo A (default: mapreduce)")
    parser.add_argument("--algo-b", default="original", help="Name of algo B (default: original)")
    parser.add_argument("--report-md", default=None, help="Output MD path (default: report.md)")
    parser.add_argument("--report-csv", default=None, help="Output CSV path (default: report.csv)")
    args = parser.parse_args()

    scores_dir = Path(args.scores_dir) if args.scores_dir else SCORES_DIR
    report_md = Path(args.report_md) if args.report_md else REPORT_MD
    report_csv = Path(args.report_csv) if args.report_csv else REPORT_CSV

    rows = load_all(scores_dir)
    if not rows:
        print(f"No scores found in {scores_dir}. Run 04_judge.py first.")
        return 1
    write_csv(rows, [args.algo_a, args.algo_b], report_csv)
    write_md(rows, args.algo_a, args.algo_b, report_md)
    print(f"Wrote {report_csv} and {report_md} ({len(rows)} papers)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
