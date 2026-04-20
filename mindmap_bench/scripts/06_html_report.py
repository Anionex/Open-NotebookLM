"""Emit a self-contained HTML report with bar + radar charts.

Reads scores/*.json (same source as 05_aggregate.py) and writes mindmap_bench/report.html
with Chart.js loaded via CDN. Single file, no assets.
"""
from __future__ import annotations
import json
from pathlib import Path
from statistics import mean, pstdev

BENCH_DIR = Path(__file__).resolve().parents[1]
SCORES_DIR = BENCH_DIR / "scores"
OUT = BENCH_DIR / "report.html"
DIMS = ["coverage", "hierarchy", "balance", "conciseness", "accuracy"]
DIMS_CN = {"coverage": "Coverage", "hierarchy": "Hierarchy", "balance": "Balance",
           "conciseness": "Conciseness", "accuracy": "Accuracy"}


def load() -> list[dict]:
    rows = []
    for p in sorted(SCORES_DIR.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if not d.get("scores"):
            continue
        m = d["mapping"]
        un = {m["A_is"]: d["scores"]["A"], m["B_is"]: d["scores"]["B"]}
        rows.append({"stem": d["stem"], "mr": un["mapreduce"], "og": un["original"]})
    return rows


def short_label(stem: str) -> str:
    parts = stem.split("_", 2)
    idx = parts[0] if parts and parts[0].isdigit() else ""
    tail = parts[2] if len(parts) > 2 else stem
    tail = tail.replace("_", " ")
    if len(tail) > 40:
        tail = tail[:37] + "..."
    return f"{idx}. {tail}" if idx else tail


def main() -> int:
    rows = load()
    n = len(rows)

    mr_means = [round(mean([r["mr"][d] for r in rows]), 2) for d in DIMS]
    og_means = [round(mean([r["og"][d] for r in rows]), 2) for d in DIMS]
    mr_std = [round(pstdev([r["mr"][d] for r in rows]), 2) for d in DIMS]
    og_std = [round(pstdev([r["og"][d] for r in rows]), 2) for d in DIMS]

    wins = {d: [0, 0, 0] for d in DIMS}  # MR, OG, Tie
    for r in rows:
        for d in DIMS:
            if r["mr"][d] > r["og"][d]: wins[d][0] += 1
            elif r["og"][d] > r["mr"][d]: wins[d][1] += 1
            else: wins[d][2] += 1

    per_paper = []
    for r in rows:
        ms = sum(r["mr"][d] for d in DIMS)
        os_ = sum(r["og"][d] for d in DIMS)
        per_paper.append({"label": short_label(r["stem"]), "delta": ms - os_,
                          "mr": ms, "og": os_})

    mr_overall = round(mean([sum(r["mr"][d] for d in DIMS) for r in rows]), 2)
    og_overall = round(mean([sum(r["og"][d] for d in DIMS) for r in rows]), 2)
    overall_wins = sum(1 for p in per_paper if p["delta"] > 0)
    overall_losses = sum(1 for p in per_paper if p["delta"] < 0)
    overall_ties = n - overall_wins - overall_losses

    data = {
        "n": n,
        "dims": [DIMS_CN[d] for d in DIMS],
        "mr_means": mr_means, "og_means": og_means,
        "mr_std": mr_std, "og_std": og_std,
        "wins": [wins[d] for d in DIMS],
        "per_paper": per_paper,
        "mr_overall": mr_overall, "og_overall": og_overall,
        "overall_wins": overall_wins, "overall_losses": overall_losses, "overall_ties": overall_ties,
    }

    html = TEMPLATE.replace("__DATA_JSON__", json.dumps(data, ensure_ascii=False))
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT}")
    return 0


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>MindMap Benchmark: MapReduce vs Original</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
         max-width: 1100px; margin: 2em auto; padding: 0 1em; color: #222; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 0.3em; }
  h2 { margin-top: 2em; border-bottom: 1px solid #ddd; padding-bottom: 0.2em; }
  .meta { color: #666; font-size: 0.95em; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1em; margin: 1em 0; }
  .stat-card { background: #f7f7f9; border: 1px solid #e0e0e6; border-radius: 8px;
               padding: 1em; text-align: center; }
  .stat-card .n { font-size: 2em; font-weight: 600; margin: 0.2em 0; }
  .stat-card .mr { color: #3b82f6; }
  .stat-card .og { color: #ef4444; }
  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; }
  .chart-wrap { background: white; border: 1px solid #eee; border-radius: 8px; padding: 1em; }
  .chart-wrap canvas { max-height: 380px; }
  .full { grid-column: span 2; }
  .legend { font-size: 0.9em; color: #666; }
  .tl { color: #3b82f6; font-weight: 600; }
  .tr { color: #ef4444; font-weight: 600; }
  footer { margin-top: 3em; font-size: 0.85em; color: #999; text-align: center; }
</style>
</head>
<body>

<h1>MindMap Benchmark: <span class="tl">MapReduce</span> vs <span class="tr">Original</span></h1>
<p class="meta">
  Generator: qwen2.5-14b-Instruct-1m (汇云, 1M context — full paper on both paths) · Judge: gemini-3-pro-preview · Dimensions 1–5
</p>

<div class="stat-grid">
  <div class="stat-card">
    <div>Papers judged</div>
    <div class="n" id="stat-n"></div>
  </div>
  <div class="stat-card">
    <div>Mean total (/25)</div>
    <div class="n"><span class="mr" id="stat-mr"></span> vs <span class="og" id="stat-og"></span></div>
  </div>
  <div class="stat-card">
    <div>Per-paper wins</div>
    <div class="n"><span class="mr" id="stat-w"></span> · <span class="og" id="stat-l"></span> · <span id="stat-t"></span></div>
    <div class="legend">MR · OG · Tie</div>
  </div>
</div>

<h2>1. Radar — overall profile</h2>
<div class="chart-row">
  <div class="chart-wrap"><canvas id="radar"></canvas></div>
  <div class="chart-wrap">
    <canvas id="bar-means"></canvas>
  </div>
</div>

<h2>2. Per-dimension wins (paired)</h2>
<div class="chart-wrap"><canvas id="wins" style="max-height:320px"></canvas></div>

<h2>3. Per-paper delta (MR − OG sum score)</h2>
<div class="chart-wrap"><canvas id="delta" style="max-height:520px"></canvas></div>

<footer>Generated from <code>mindmap_bench/scores/*.json</code> via <code>scripts/06_html_report.py</code></footer>

<script>
const DATA = __DATA_JSON__;

document.getElementById('stat-n').textContent = DATA.n;
document.getElementById('stat-mr').textContent = DATA.mr_overall;
document.getElementById('stat-og').textContent = DATA.og_overall;
document.getElementById('stat-w').textContent = DATA.overall_wins;
document.getElementById('stat-l').textContent = DATA.overall_losses;
document.getElementById('stat-t').textContent = DATA.overall_ties;

const BLUE = 'rgba(59,130,246,0.7)';
const BLUE_BORDER = 'rgb(59,130,246)';
const RED = 'rgba(239,68,68,0.7)';
const RED_BORDER = 'rgb(239,68,68)';

// Radar
new Chart(document.getElementById('radar'), {
  type: 'radar',
  data: {
    labels: DATA.dims,
    datasets: [
      { label: 'MapReduce', data: DATA.mr_means, backgroundColor: BLUE, borderColor: BLUE_BORDER, pointBackgroundColor: BLUE_BORDER },
      { label: 'Original',  data: DATA.og_means, backgroundColor: RED,  borderColor: RED_BORDER,  pointBackgroundColor: RED_BORDER }
    ]
  },
  options: {
    responsive: true,
    scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } },
    plugins: { title: { display: true, text: 'Mean score per dimension' } }
  }
});

// Bar means with error bars (approximated via ±std in label)
new Chart(document.getElementById('bar-means'), {
  type: 'bar',
  data: {
    labels: DATA.dims,
    datasets: [
      { label: 'MapReduce', data: DATA.mr_means, backgroundColor: BLUE, borderColor: BLUE_BORDER, borderWidth: 1 },
      { label: 'Original',  data: DATA.og_means, backgroundColor: RED,  borderColor: RED_BORDER,  borderWidth: 1 }
    ]
  },
  options: {
    responsive: true,
    scales: { y: { min: 0, max: 5, ticks: { stepSize: 1 } } },
    plugins: {
      title: { display: true, text: 'Mean (bars) — std in tooltip' },
      tooltip: { callbacks: { afterLabel: (ctx) => {
        const std = ctx.datasetIndex === 0 ? DATA.mr_std : DATA.og_std;
        return '± ' + std[ctx.dataIndex];
      } } }
    }
  }
});

// Wins per dim (stacked bar)
const mrWins = DATA.wins.map(w => w[0]);
const ogWins = DATA.wins.map(w => w[1]);
const ties   = DATA.wins.map(w => w[2]);
new Chart(document.getElementById('wins'), {
  type: 'bar',
  data: {
    labels: DATA.dims,
    datasets: [
      { label: 'MR wins', data: mrWins, backgroundColor: BLUE },
      { label: 'OG wins', data: ogWins, backgroundColor: RED },
      { label: 'Ties',    data: ties,   backgroundColor: '#d1d5db' }
    ]
  },
  options: {
    responsive: true,
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    plugins: { title: { display: true, text: 'Paired wins per dimension (n=' + DATA.n + ')' } }
  }
});

// Per-paper delta
const sorted = [...DATA.per_paper].sort((a,b) => b.delta - a.delta);
new Chart(document.getElementById('delta'), {
  type: 'bar',
  data: {
    labels: sorted.map(p => p.label),
    datasets: [{
      label: 'MR − OG (sum /25)',
      data: sorted.map(p => p.delta),
      backgroundColor: sorted.map(p => p.delta > 0 ? BLUE : (p.delta < 0 ? RED : '#9ca3af')),
      borderColor:     sorted.map(p => p.delta > 0 ? BLUE_BORDER : (p.delta < 0 ? RED_BORDER : '#6b7280')),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    scales: { x: { title: { display: true, text: 'Δ (positive = MR wins)' } } },
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Δ per paper — blue=MR wins, red=OG wins' },
      tooltip: { callbacks: { afterLabel: (ctx) => {
        const p = sorted[ctx.dataIndex];
        return 'MR=' + p.mr + '  OG=' + p.og;
      } } }
    }
  }
});
</script>
</body>
</html>
"""


if __name__ == "__main__":
    raise SystemExit(main())
