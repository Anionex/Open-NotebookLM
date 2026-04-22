# MindMap Benchmark — 交接说明书

这是一套对比 **MapReduce 思维导图流水线** 与 **原始单次调用流水线** 的 LLM-as-judge 测试框架。如果你要继续迭代 MapReduce 算法，先把这份文档从头读完再动手。

---

## 0. 这是在测什么

在 `feat/mindmap-mapreduce` 分支上，我们给 `wf_kb_mindmap.py` 加了一条 **MapReduce 路径**（长文本走 chunk → Map → Collapse → Reduce），用来解决"文档长到塞不进上下文就被截断"的问题。原始单次调用路径在 `opendcai/thinkflow` 分支上。

我们想知道：**MR 路径真的比 OG 好吗？好在哪？差在哪？**

做法：20 篇综述论文 → 两条路径各跑一遍 → 把两份思维导图丢给 Gemini-3-Pro 做 paired A/B 打分 → 聚合成报告。

当前结果（v6）：**MR 胜率 17%**，主要伤口是 `hierarchy`（3.56 vs 4.83）。详见 `report_v6.html`。

---

## 1. 目录地图

```
mindmap_bench/
├── README.md                      # 本文档
├── arxiv_ids.txt                  # 20 篇论文的 arxiv ID 清单
├── papers/                        # PDF 原始文件（gitignored）
├── papers_md/                     # PDF→MD 转换结果（gitignored）
│
├── scripts/                       # 流水线脚本（6 步 + 2 个工具）
│   ├── 01_collect_papers.py       # 下载 arxiv PDF
│   ├── 02_convert_pdfs.sh         # mineru-open-api 转 MD
│   ├── 03_run_algorithm.py        # 在某个 worktree 上跑 wf_kb_mindmap
│   ├── 04_judge.py                # gemini-3-pro paired A/B 打分
│   ├── 05_aggregate.py            # 聚合分数 → report.md / report.csv
│   ├── 06_html_report.py          # 生成 report.html（Chart.js 可视化）
│   ├── normalize_format.py        # 把 OG 的 Mermaid 输出转成 Markdown 标题
│   └── compare_v4_v5.py           # v4-MR vs v5-MR 直接对比（控制 judge 噪声用）
│
├── results/
│   ├── mapreduce/<paper>.md       # 当前轮 MR 输出（gitignored）
│   ├── original/<paper>.md        # OG 原始 Mermaid 输出（gitignored）
│   └── original_md/<paper>.md     # OG 规范化后（gitignored，judge 用这个）
│
├── scores/<paper>.json            # 当前轮 judge 分数（gitignored）
├── report.{md,csv,html}           # 当前轮报告（gitignored，跑完手动重命名成 v<N>）
│
├── _vN_mapreduce/                 # 历史轮 MR 输出（被 rename 归档，gitignored）
├── _vN_scores/                    # 历史轮 judge 分数（同上）
├── report_v1~v6.{md,csv,html}     # 历史轮报告（**git tracked**）
│
└── _staging/, _logs/              # 跑 workflow 时的中间产物（gitignored）
```

在 `.claude/worktrees/` 下有两个**只读**的 git worktree：

```
.claude/worktrees/
├── bench-mapreduce/    # feat/mindmap-mapreduce 分支，带 MR 改动
└── bench-original/     # opendcai/thinkflow 最新 commit，detached HEAD，**只读**
```

> **重要**：`bench-original` 对应的是 opendcai remote，永远不要在那里 commit / push。见 `~/.claude/projects/-Users-davidyang-Open-NotebookLM/memory/feedback_opendcai_remote.md`。

---

## 2. 一次完整回归（Round v<N>）的完整命令

### 前置
```bash
source /Users/davidyang/Open-NotebookLM/.venv/bin/activate
cd /Users/davidyang/Open-NotebookLM/mindmap_bench
```

### Step 3：两条路径各跑一遍

**不要用 aihubmix 跑生成**。组内有汇云代理，额度 $500，并发友好。

```bash
# 只要你改了 MR 代码就必须重跑这条
BENCH_GEN_API_URL="http://123.129.219.111:3000/v1" \
BENCH_GEN_API_KEY="sk-o1KiDtS2UQPArZnvrkzCQkA9cm49sHTObbpVJovSw2caLO4J" \
BENCH_GEN_MODEL="gemini-3-flash-preview" \
BENCH_GEN_CONCURRENCY=20 \
python scripts/03_run_algorithm.py \
  --worktree /Users/davidyang/Open-NotebookLM/.claude/worktrees/bench-mapreduce \
  --out /Users/davidyang/Open-NotebookLM/mindmap_bench/results/mapreduce

# OG 只有在你更新了 opendcai worktree 时才需要重跑；否则复用 _v6_original_md/ 或上次的
BENCH_GEN_API_URL="http://123.129.219.111:3000/v1" \
BENCH_GEN_API_KEY="sk-o1KiDtS2UQPArZnvrkzCQkA9cm49sHTObbpVJovSw2caLO4J" \
BENCH_GEN_MODEL="gemini-3-flash-preview" \
BENCH_GEN_CONCURRENCY=20 \
python scripts/03_run_algorithm.py \
  --worktree /Users/davidyang/Open-NotebookLM/.claude/worktrees/bench-original \
  --out /Users/davidyang/Open-NotebookLM/mindmap_bench/results/original

# OG 输出是 Mermaid，必须规范化后 judge 才公平
python scripts/normalize_format.py
```

**关于并发：** 汇云对 gemini-3-flash 并发 20 没问题。aihubmix 对 gemini-3-pro 并发 >4 会 429。

### Step 4：judge 打分

```bash
# 汇云上也有 gemini-3-pro-preview，和 aihubmix 一样
BENCH_JUDGE_API_URL="http://123.129.219.111:3000/v1/chat/completions" \
BENCH_JUDGE_API_KEY="sk-o1KiDtS2UQPArZnvrkzCQkA9cm49sHTObbpVJovSw2caLO4J" \
BENCH_JUDGE_CONCURRENCY=10 \
python scripts/04_judge.py
```

Judge 对每篇论文做的事：
- 读原文 MD（截断到 180K 字符，gemini-3-pro 窗口够用）
- 随机决定 MR / OG 哪个当 A 哪个当 B（种子是 `hash(stem) & 0xFFFFFFFF`，**可复现**）
- 按 5 个维度各打 1-5 分：`coverage / hierarchy / balance / conciseness / accuracy`
- 每个维度都要给 `rationale`（看 rationale 比看分数重要，见 §5）
- 结果写到 `scores/<paper>.json`

### Step 5：聚合 + 出报告

```bash
python scripts/05_aggregate.py   # → report.md + report.csv
python scripts/06_html_report.py # → report.html
```

### Step 6：归档

```bash
N=7  # 下一个版本号
mv results/mapreduce _v${N}_mapreduce
mv scores _v${N}_scores
mv report.md report_v${N}.md
mv report.csv report_v${N}.csv
mv report.html report_v${N}.html
mkdir -p results/mapreduce scores
```

把 `report_v${N}.{md,csv,html}` 提交（gitignored 的产物目录**不提**）。

---

## 3. 关键代码入口

### MR 流水线本体
- **文件**：`.claude/worktrees/bench-mapreduce/workflow_engine/workflow/wf_kb_mindmap.py`（~1050 行）
- **state**：`.claude/worktrees/bench-mapreduce/workflow_engine/state.py` → `class KBMindMapState`
- **节点**：`parse_files → chunk_and_route → map_phase → collapse_phase ⟲ → reduce_phase → save_and_end`
- **路由阈值**：`_get_chunk_token_limit = context_window × 0.4`。超了走 MR，否则走单次调用。

### Prompt 关键函数
| 函数 | 行号（v6 当前） | 作用 |
|---|---|---|
| `_build_single_pass_prompt` | ~261 | 短文本单次调用 |
| `_build_map_prompt` | ~331 | 每个 chunk 抽节点 + chunk_summary |
| `_build_collapse_prompt` | ~397 | 两组节点合并去重 |
| `_build_reduce_prompt` | ~444 | 结构化节点 → Markdown 思维导图 |

> **先读这四个 prompt 再动手改任何东西。** 很多"bug"其实是 prompt 在约束我们自己。举个例子，v6 的 Map prompt 写了"**输出语言必须是 {language}**，不可使用其他语言"，于是听话的 Flash 把 Transformer 翻成"变压器"、π/2 翻成"二分之派"——问题不在模型，在我们 prompt 太绝对。

### Collapse 现状（很有改进空间）
- **分组策略**：`_split_nodes_into_groups` 只按 **原 map_results 顺序 + token 预算** 切片，没有任何主题聚类
- **配对策略**：相邻两组 `(g0+g1, g2+g3, …)` 全量并行合并
- **问题**：只要 token 超限一点点，也会把所有 pair 全合一遍，得不偿失
- **改进方向**：按"超额量"只挑最大的 k 对合并，或做主题聚类把同类节点先聚起来

### Reduce 的 score→层级假规则
`_build_reduce_prompt` 要求：score=5 → root、≥4 → `##`、≥3 → `###`。

**这是错的**。`importance_score` 是"这点多值得记"，层级是"概念包含关系"，两个轴正交。而且 score 是每个 chunk 内部打的，Map LLM 看不到全文，chunk-local 的 5 分不等于 global 的 5 分。这是 MR 在 hierarchy 上输 OG 的系统性原因。

---

## 4. 历史轮次摘要

| Round | 主要改动 | MR/OG (/25) | Δ | MR 胜率 |
|---|---|---|---|---|
| v1 | 初始：MR 混格式，OG 用 Mermaid | 格式不公，废 | — | — |
| v2 | 两边同模型、同输入（qwen2.5-14b） | 13.90 / 20.60 | -6.70 | — |
| v3 | 生成切到 gemini-3-flash（汇云） | 18.45 / 24.40 | -5.95 | 5% |
| v4 | Map+Reduce 注入原文 heading 骨架 | 19.75 / 23.80 | -4.05 | 20% |
| v5 | Reduce 再注入开头一段作为"作者脉络" | 18.80 / 24.15 | -5.35 | 5% ⚠️ |
| v6 | Map 输出 chunk_summary 喂给 Reduce | 19.67 / 23.72 | -4.06 | 17% |

**v4→v5 的假回退教训**：v5 看起来变差是 judge 噪声，不是算法变差。证据来自 `scripts/compare_v4_v5.py` 的 head-to-head（v4-MR vs v5-MR 直接对比，MR 对 MR，消掉了 OG 漂移），结论是 v5 在 coverage/accuracy 上有小幅提升。**跨轮次 OG 分数会漂移**（哪怕 OG 文件没变），因此**看 MR-vs-OG 的绝对分差要谨慎，head-to-head 才是干净的诊断**。

---

## 5. 怎么读 Gemini-Pro 的 feedback

`scores/<paper>.json` 每一条长这样：

```json
{
  "stem": "07_...",
  "mapping": { "A_is": "original", "B_is": "mapreduce" },
  "scores": {
    "A": { "coverage": 5, "hierarchy": 5, ..., "rationale": "..." },
    "B": { "coverage": 4, "hierarchy": 3, ..., "rationale": "..." }
  }
}
```

> `A_is` / `B_is` 是这次随机的映射。**分析时要先还原**：MR 分数 = `scores[A]` 还是 `scores[B]` 取决于 `A_is`。脚本里都处理好了，你手查时注意。

**诊断缺陷的正确姿势：**

1. **先排序找输得最惨的**：`report_vN.md` 里有"Strong wins (Δ ≥ 3)"那段，或者：
   ```python
   # 找 Δ ≤ -6 的纸（也就是 MR 输 6 分以上的）
   ```
2. **读 rationale 而不是数字**：数字告诉你"差多少"，rationale 告诉你"差在哪"。Gemini-Pro 的 rationale 通常很具体，比如"把 MMRotate 错放到了特征表示下"、"把作者所属院校当主分支"、"π/2 翻译成二分之派"。这些是可以直接对应到 prompt / 代码改动的。
3. **归类**：同一个缺陷会在多篇里反复出现。v6 里归纳出来的四大缺陷是：
   - 层级组织错乱（8/8 输 ≥6 分的都中）
   - 专业术语被机翻（Transformer → 变压器）
   - 琐碎信息挤占主线（IEEE 页数、作者院校当主分支）
   - 章节重构能力不足（MR 只能章节平移，OG 能按高维主题重构）

**已经归纳好的 v6 缺陷清单在对话历史里**，但以后每轮都要重新做一遍。

**提示词技巧：** 让 Claude 帮你批量读 rationale 时，给它明确的分类框架（比如"按层级/术语/细节/重构四类归纳"），不要让它自由发挥，不然它会给你写一堆抽象套话。

---

## 6. 容易踩的坑

- **忘记 `source .venv/bin/activate`**：后台任务不带 venv 会 `python: command not found`。
- **生成和判分混用 API**：生成用汇云（量大、便宜），判分用汇云（同一个 API 也支持 gemini-3-pro），**不要默认回 aihubmix**（会 429，还扣别人额度）。
- **OG 没 normalize 就丢 judge**：OG 输出的是 Mermaid 代码，judge 看格式就开始减 conciseness 分，很不公平。
- **在 `bench-original` worktree 里 commit**：那是 opendcai remote 的只读快照，**永远不要推东西回去**。
- **只看均值不看 win-rate**：judge 有绝对分数漂移但 paired ordering 稳定，看 paired wins 更可靠。
- **直接改 `wf_kb_mindmap.py` 的主仓副本**：MR 改动应该在 `bench-mapreduce` worktree 里做，主仓那份不受 benchmark 使用。
- **清空 `results/mapreduce/` 前没归档**：跑新轮前记得 `mv` 成 `_v<N>_mapreduce`，否则历史就没了。

---

## 7. 改进方向（优先级排序）

基于 v6 的失败归因，由易到难：

1. **Prompt 术语白名单**：一行改动，让 Map/Reduce/single_pass prompt 明确说"保留英文专有名词、模型名、数学符号原形"，别再出现"变压器"。
2. **去掉 score→层级映射**：score 只用来决定"保留/删除"，不决定层级；层级交给 LLM 基于 parent_topic + heading_skeleton + chunk_summary 自行组织。
3. **Collapse 按需合并**：只挑最大的 k 组合并（k = 能盖住 token 超额的最少数量），而不是全量两两合。
4. **琐碎信息过滤**：Map prompt 明确排除页码、作者、院校、arxiv 编号；Collapse 的 prune 阈值从 `≤1` 提到 `≤2`。
5. **Reduce 两步法**：先让 LLM 基于 heading_skeleton + chunk_summaries 规划主分支骨架，再把节点填进去（而不是一次把节点列表塞给它让它自生自灭）。
6. **Collapse 主题聚类**：把节点先按 topic 语义聚类再配对合并，跨 chunk 的重复主题才能真的合起来。

每次改完都要跑一轮完整 benchmark 验证。**单篇手动看不算数**——judge 有噪声，n=20 的聚合才稳。
