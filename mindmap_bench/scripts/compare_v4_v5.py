"""Head-to-head judge: v4-MR vs v5-MR (same dimensions). Isolates algo change from OG drift."""
from __future__ import annotations
import asyncio, json, os, random, re, sys, time
from pathlib import Path
import httpx

BENCH = Path(__file__).resolve().parents[1]
V4 = BENCH / "_v4_mapreduce"
V5 = BENCH / "results" / "mapreduce"
MD  = BENCH / "papers_md"
OUT = BENCH / "_v5_vs_v4_scores"
OUT.mkdir(exist_ok=True)

API_URL = os.getenv("BENCH_JUDGE_API_URL", "https://aihubmix.com/v1/chat/completions")
API_KEY = os.getenv("BENCH_JUDGE_API_KEY", "")
MODEL = "gemini-3-pro-preview"
DIMS = ["coverage", "hierarchy", "balance", "conciseness", "accuracy"]
CAP = 180000

PROMPT = """你是思维导图质量评审员。下面给你一篇论文的 Markdown 全文，以及两份由不同版本算法生成的思维导图 A 与 B。两份均为同一格式（Markdown 标题树），请只评估内容与结构质量。

评分维度（各 1-5 分）：
- coverage / hierarchy / balance / conciseness / accuracy

严格 JSON（无围栏）：
{{"A":{{"coverage":int,"hierarchy":int,"balance":int,"conciseness":int,"accuracy":int,"rationale":"..."}},"B":{{"coverage":int,"hierarchy":int,"balance":int,"conciseness":int,"accuracy":int,"rationale":"..."}}}}

[SOURCE]
{src}

[A]
{a}

[B]
{b}

请直接输出 JSON："""


def parse(raw: str):
    t = raw.strip()
    if t.startswith("```"):
        t = "\n".join(l for l in t.split("\n") if not l.strip().startswith("```"))
    try: return json.loads(t)
    except Exception: pass
    m = re.search(r"\{[\s\S]*\}", t)
    if m:
        try: return json.loads(m.group())
        except Exception: return None
    return None


async def run_one(stem: str, client, sem):
    out = OUT / f"{stem}.json"
    if out.exists(): return stem, "skip"
    async with sem:
        v4p = V4 / f"{stem}.md"; v5p = V5 / f"{stem}.md"; srcp = MD / f"{stem}.md"
        if not (v4p.exists() and v5p.exists() and srcp.exists()):
            return stem, "missing"
        src = srcp.read_text()[:CAP]
        rng = random.Random(hash(stem) & 0xFFFFFFFF)
        if rng.random() < 0.5:
            a_ver, b_ver = "v4", "v5"; a_md, b_md = v4p.read_text(), v5p.read_text()
        else:
            a_ver, b_ver = "v5", "v4"; a_md, b_md = v5p.read_text(), v4p.read_text()
        prompt = PROMPT.format(src=src, a=a_md, b=b_md)
        for attempt in range(3):
            try:
                r = await client.post(API_URL,
                    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                    json={"model": MODEL, "messages": [{"role":"user","content":prompt}], "temperature": 0.2, "max_tokens": 3000},
                    timeout=180)
                r.raise_for_status()
                parsed = parse(r.json()["choices"][0]["message"]["content"])
                if parsed and all(d in parsed.get("A",{}) and d in parsed.get("B",{}) for d in DIMS):
                    out.write_text(json.dumps({"stem":stem,"mapping":{"A":a_ver,"B":b_ver},"scores":parsed}, ensure_ascii=False, indent=2))
                    a_sum = sum(parsed["A"][d] for d in DIMS); b_sum = sum(parsed["B"][d] for d in DIMS)
                    return stem, f"A={a_ver}({a_sum}) B={b_ver}({b_sum})"
            except Exception as e:
                last = e
            await asyncio.sleep(2*(attempt+1))
        return stem, f"FAIL"


async def main():
    stems = sorted(p.stem for p in V5.glob("*.md"))
    sem = asyncio.Semaphore(5)
    async with httpx.AsyncClient() as c:
        results = await asyncio.gather(*[run_one(s, c, sem) for s in stems])
    for s, m in results: print(f"  [{s}] {m}")
    # aggregate
    v4_totals = []; v5_totals = []; v4_dims = {d:[] for d in DIMS}; v5_dims = {d:[] for d in DIMS}
    for s in stems:
        f = OUT / f"{s}.json"
        if not f.exists(): continue
        d = json.loads(f.read_text())
        a_ver = d["mapping"]["A"]; sc = d["scores"]
        v4_scores = sc["A"] if a_ver == "v4" else sc["B"]
        v5_scores = sc["B"] if a_ver == "v4" else sc["A"]
        v4_totals.append(sum(v4_scores[d_] for d_ in DIMS))
        v5_totals.append(sum(v5_scores[d_] for d_ in DIMS))
        for d_ in DIMS:
            v4_dims[d_].append(v4_scores[d_]); v5_dims[d_].append(v5_scores[d_])
    n = len(v4_totals)
    if n == 0:
        print("no results"); return
    print(f"\n=== v4 vs v5 head-to-head ({n} papers) ===")
    print(f"v4 mean sum: {sum(v4_totals)/n:.2f}")
    print(f"v5 mean sum: {sum(v5_totals)/n:.2f}")
    print(f"Δ (v5-v4):   {(sum(v5_totals)-sum(v4_totals))/n:+.2f}")
    for d in DIMS:
        v4m = sum(v4_dims[d])/n; v5m = sum(v5_dims[d])/n
        print(f"  {d:12s}: v4 {v4m:.2f}  v5 {v5m:.2f}  Δ {v5m-v4m:+.2f}")
    v5_wins = sum(1 for i in range(n) if v5_totals[i] > v4_totals[i])
    v4_wins = sum(1 for i in range(n) if v4_totals[i] > v5_totals[i])
    print(f"paired wins:  v5 {v5_wins} / v4 {v4_wins} / tie {n-v5_wins-v4_wins}")

if __name__ == "__main__":
    if not API_KEY: print("set BENCH_JUDGE_API_KEY"); sys.exit(2)
    asyncio.run(main())
