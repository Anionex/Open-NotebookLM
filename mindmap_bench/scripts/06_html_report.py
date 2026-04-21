"""Emit a self-contained HTML report with bar + radar charts.

Reads scores/*.json (same source as 05_aggregate.py) and writes mindmap_bench/report.html
with Chart.js loaded via CDN. Single file, no assets.
"""
from __future__ import annotations
import json
import os
import re
from pathlib import Path
from statistics import mean, pstdev

BENCH_DIR = Path(__file__).resolve().parents[1]
SCORES_DIR = Path(os.getenv("BENCH_SCORES_DIR", BENCH_DIR / "scores"))
MR_DIR = Path(os.getenv("BENCH_MR_DIR", BENCH_DIR / "results" / "mapreduce"))
OG_DIR = Path(os.getenv("BENCH_OG_DIR", BENCH_DIR / "results" / "original"))
PAPERS_MD_DIR = Path(os.getenv("BENCH_PAPERS_MD_DIR", BENCH_DIR / "papers_md"))
OUT = Path(os.getenv("BENCH_REPORT_HTML", BENCH_DIR / "report.html"))
DIMS = ["coverage", "hierarchy", "balance", "conciseness", "accuracy"]
DIMS_CN = {"coverage": "Coverage", "hierarchy": "Hierarchy", "balance": "Balance",
           "conciseness": "Conciseness", "accuracy": "Accuracy"}


def normalize_mindmap(raw: str) -> str:
    """Pass raw mindmap text through; JS side handles both mermaid mindmap and md heading."""
    return (raw or "").strip() + "\n"


def extract_paper_meta(md_path: Path) -> dict:
    """Return {title, abstract, char_count, word_count, section_count} from source md."""
    if not md_path.exists():
        return {"title": "", "abstract": "", "char_count": 0, "word_count": 0, "section_count": 0}
    text = md_path.read_text(encoding="utf-8", errors="ignore")
    char_count = len(text)
    word_count = len(re.findall(r"\S+", text))
    section_count = len(re.findall(r"(?m)^#{1,6}\s+", text))

    lines = text.splitlines()
    title = ""
    for ln in lines[:5]:
        m = re.match(r"^#\s+(.+?)\s*$", ln)
        if m:
            title = m.group(1).strip()
            break

    abstract = ""
    abs_re = re.compile(r"abstract[\s\-—:—.]*", re.IGNORECASE)
    for i, ln in enumerate(lines):
        if abs_re.match(ln.strip()[:40]):
            m = re.match(r"(?i)abstract[\s\-—:.—]*(.*)", ln.strip())
            seed = m.group(1).strip() if m else ""
            parts = [seed] if seed else []
            for j in range(i + 1, min(i + 80, len(lines))):
                s = lines[j].rstrip()
                if not s.strip():
                    if parts:
                        break
                    continue
                if re.match(r"^#{1,6}\s", s) or re.match(r"^Index Terms", s, re.I):
                    break
                parts.append(s.strip())
            abstract = " ".join(parts).strip()
            break
    if not abstract:
        body_start = 0
        for i, ln in enumerate(lines):
            if ln.startswith("# "):
                body_start = i + 1
                break
        buf = []
        for s in lines[body_start:body_start + 40]:
            if re.match(r"^#{1,6}\s", s):
                if buf: break
                continue
            if s.strip():
                buf.append(s.strip())
            elif buf:
                break
        abstract = " ".join(buf).strip()

    if len(abstract) > 1500:
        abstract = abstract[:1500].rstrip() + " …"
    return {"title": title, "abstract": abstract,
            "char_count": char_count, "word_count": word_count,
            "section_count": section_count}


def load() -> list[dict]:
    rows = []
    for p in sorted(SCORES_DIR.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if not d.get("scores"):
            continue
        m = d["mapping"]
        un = {m["A_is"]: d["scores"]["A"], m["B_is"]: d["scores"]["B"]}
        stem = d["stem"]
        mr_path = MR_DIR / f"{stem}.md"
        og_path = OG_DIR / f"{stem}.md"
        mr_mm = normalize_mindmap(mr_path.read_text(encoding="utf-8")) if mr_path.exists() else ""
        og_mm = normalize_mindmap(og_path.read_text(encoding="utf-8")) if og_path.exists() else ""
        meta = extract_paper_meta(PAPERS_MD_DIR / f"{stem}.md")
        rationale = {
            "mr": (d["scores"]["A"].get("rationale") if m["A_is"] == "mapreduce" else d["scores"]["B"].get("rationale")) or "",
            "og": (d["scores"]["A"].get("rationale") if m["A_is"] == "original"  else d["scores"]["B"].get("rationale")) or "",
        }
        rows.append({
            "stem": stem,
            "mr": un["mapreduce"], "og": un["original"],
            "mr_mm": mr_mm, "og_mm": og_mm,
            "meta": meta, "rationale": rationale,
        })
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
        per_paper.append({"stem": r["stem"], "label": short_label(r["stem"]),
                          "delta": ms - os_, "mr": ms, "og": os_,
                          "mr_mm": r["mr_mm"], "og_mm": r["og_mm"],
                          "meta": r["meta"], "rationale": r["rationale"],
                          "mr_scores": r["mr"], "og_scores": r["og"]})

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
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-view@0.17"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.17"></script>
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
  .mm-controls { display: flex; gap: 1em; align-items: center; margin: 1em 0; flex-wrap: wrap; }
  .mm-controls select { flex: 1; min-width: 320px; padding: 0.4em; font-size: 1em; }
  .mm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
  .mm-panel { background: white; border: 1px solid #eee; border-radius: 8px; padding: 1em;
              overflow: auto; min-height: 520px; max-height: 85vh; }
  .mm-panel h3 { margin: 0 0 0.6em 0; font-size: 1em; }
  .mm-panel.mr h3 { color: #3b82f6; }
  .mm-panel.og h3 { color: #ef4444; }
  .mm-panel .render { width: 100%; height: 640px; overflow: hidden; background: #fafafa;
                       border: 1px dashed #ddd; border-radius: 4px; }
  .mm-panel .err { color: #b91c1c; font-size: 0.85em; white-space: pre-wrap; }
  details.src { margin-top: 0.6em; font-size: 0.85em; color: #666; }
  details.src pre { background: #f8f8fa; padding: 0.6em; border-radius: 4px; overflow: auto;
                    max-height: 220px; white-space: pre-wrap; word-break: break-word; }
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

<h2>4. Side-by-side mindmap compare</h2>
<div class="mm-controls">
  <label for="mm-select"><strong>Pick a paper:</strong></label>
  <select id="mm-select"></select>
</div>
<details class="src" id="paper-meta">
  <summary><span id="meta-title">论文信息（点击展开）</span></summary>
  <div style="margin-top:0.6em">
    <div id="meta-stats" class="legend"></div>
    <p id="meta-abstract" style="margin-top:0.8em; line-height:1.55"></p>
  </div>
</details>
<div class="mm-row">
  <div class="mm-panel mr">
    <h3>MapReduce（<span id="mr-score"></span>）</h3>
    <div id="mm-mr" class="render"></div>
    <details class="src"><summary>查看 Markdown / Mermaid 源码</summary><pre id="mr-src"></pre></details>
    <details class="src"><summary>Judge rationale</summary><p id="mr-rat" style="line-height:1.5"></p></details>
  </div>
  <div class="mm-panel og">
    <h3>Original（<span id="og-score"></span>）</h3>
    <div id="mm-og" class="render"></div>
    <details class="src"><summary>查看 Mermaid 源码</summary><pre id="og-src"></pre></details>
    <details class="src"><summary>Judge rationale</summary><p id="og-rat" style="line-height:1.5"></p></details>
  </div>
</div>

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

// Side-by-side mindmap picker
const sel = document.getElementById('mm-select');
DATA.per_paper.forEach((p, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  const sign = p.delta > 0 ? '+' : '';
  opt.textContent = `${p.label}  [MR ${p.mr} vs OG ${p.og}, Δ${sign}${p.delta}]`;
  sel.appendChild(opt);
});

// --- Ported from frontend_en/src/utils/mermaidToMarkdown.ts ---
function stripShapeDecorators(text) {
  return text
    .replace(/^\(\((.+?)\)\)$/, '$1')
    .replace(/^\((.+?)\)$/, '$1')
    .replace(/^\[(.+?)\]$/, '$1')
    .replace(/^\{\{(.+?)\}\}$/, '$1')
    .replace(/^\)(.+?)\($/, '$1')
    .replace(/^>(.+?)\]$/, '$1');
}
function isMermaidMindmap(code) { return code.trimStart().startsWith('mindmap'); }
function mermaidToMarkdown(code) {
  const lines = code.split('\n');
  const out = [];
  const indentStack = [];
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.trim() === 'mindmap') continue;
    const indent = line.length - line.trimStart().length;
    let text = trimmed.trim();
    if (text.startsWith('root')) {
      text = stripShapeDecorators(text.replace(/^root\s*/, '').trim());
      indentStack.length = 0; indentStack.push(indent);
      out.push(`# ${text}`);
      continue;
    }
    text = stripShapeDecorators(text);
    while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) indentStack.pop();
    if (indent > indentStack[indentStack.length - 1]) indentStack.push(indent);
    const depth = Math.min(indentStack.length, 6);
    out.push('#'.repeat(depth) + ' ' + text);
  }
  return out.join('\n');
}

// --- markmap renderer ---
const _mmInstances = {};
let _mmTransformer = null;
function getTransformer() {
  if (_mmTransformer) return _mmTransformer;
  const T = window.markmap && window.markmap.Transformer;
  if (!T) return null;
  _mmTransformer = new T();
  return _mmTransformer;
}
function renderPane(containerId, raw) {
  const el = document.getElementById(containerId);
  if (_mmInstances[containerId]) { try { _mmInstances[containerId].destroy(); } catch(_){} delete _mmInstances[containerId]; }
  el.innerHTML = '';
  if (!raw || !raw.trim()) { el.innerHTML = '<p class="err" style="padding:1em">（缺少思维导图文件）</p>'; return; }
  const md = isMermaidMindmap(raw) ? mermaidToMarkdown(raw) : raw;
  try {
    const Markmap = window.markmap && window.markmap.Markmap;
    const transformer = getTransformer();
    if (!Markmap || !transformer) { el.innerHTML = '<p class="err" style="padding:1em">markmap 未加载</p>'; return; }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'width:100%;height:100%;display:block');
    el.appendChild(svg);
    const { root } = transformer.transform(md);
    const mm = Markmap.create(svg, { duration: 200, maxWidth: 320, spacingVertical: 5 }, root);
    _mmInstances[containerId] = mm;
    setTimeout(() => { try { mm.fit(); } catch(_){} }, 30);
  } catch (e) {
    el.innerHTML = '<p class="err" style="padding:1em">渲染失败：' + (e && e.message ? e.message : e) + '</p>';
  }
}

function fmtScores(s) {
  return `C${s.coverage} H${s.hierarchy} B${s.balance} Co${s.conciseness} A${s.accuracy} = ${s.coverage+s.hierarchy+s.balance+s.conciseness+s.accuracy}`;
}

async function onPick() {
  const p = DATA.per_paper[+sel.value];
  document.getElementById('mr-score').textContent = fmtScores(p.mr_scores);
  document.getElementById('og-score').textContent = fmtScores(p.og_scores);
  document.getElementById('mr-src').textContent = p.mr_mm || '(empty)';
  document.getElementById('og-src').textContent = p.og_mm || '(empty)';
  document.getElementById('mr-rat').textContent = p.rationale.mr || '(no rationale)';
  document.getElementById('og-rat').textContent = p.rationale.og || '(no rationale)';
  const meta = p.meta || {};
  const title = meta.title || p.label;
  document.getElementById('meta-title').textContent = '论文信息：' + title + '（点击展开）';
  const kChars = (meta.char_count || 0).toLocaleString();
  const kWords = (meta.word_count || 0).toLocaleString();
  document.getElementById('meta-stats').innerHTML =
    `<strong>长度</strong>：${kChars} 字符 · ${kWords} 词 · ${meta.section_count || 0} 个 heading`;
  document.getElementById('meta-abstract').textContent = meta.abstract || '（未提取到 Abstract）';
  renderPane('mm-mr', p.mr_mm);
  renderPane('mm-og', p.og_mm);
}
sel.addEventListener('change', onPick);
window.addEventListener('load', () => { sel.value = 0; onPick(); });

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
