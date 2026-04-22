from __future__ import annotations
from typing import List, Dict


# ==================== 共用规则文本（避免在多个 prompt 中重复） ====================

_BRANCH_RULES_ZH = """\
**主分支命名硬约束（违反则立刻重写）**：
- 主分支（##）必须是"概念主题 / 方法模块 / 问题域 / 应用领域 / 关键发现"
- 严禁出现以下"叙事脚手架"作为主分支：背景介绍、研究背景、发展历程、演进历程、技术演进、章节概览、文章结构、章节安排、前沿方向、未来展望、未来趋势、未来工作、研究展望、相关综述、综述对比、挑战与展望、总结与展望、引言、结论、附录、参考文献、致谢
- 严禁以"年份 / 时间 / 顺序"作为分类轴（错误："2010 年早期探索 / 2013 年关键突破 / 2015 年技术成熟"；正确：把这些技术按方法族归类，年份写在节点 summary 里）
- 严禁出现"核心问题 / 解决方案 / 关键发现 / 主要内容 / 研究方法 / 主要贡献"这类空壳容器节点，必须用具体的概念词替代
- 主分支应当具备信息密度：让读者看到主分支名就能猜到大致内容（例："深度 Q 网络与扩展" 优于 "算法部分"；"3D 点云语义分割" 优于 "应用场景"）
"""

_NAMING_RULES_ZH = """\
**节点命名规则**：
1. 每个节点 3–12 个字的短语；优先使用方法名 / 现象名 / 任务名 / 模型名 / 关键术语
2. 严禁在节点名中使用括号补说（错例：`Grover 算法 (O(√n))` → 正确：`Grover 算法` 下设 `时间复杂度 O(√n)`）
3. 严禁孤立的"年份 / 百分比 / 数字 / 金额"作为节点名（错例：`2013 年`、`76.0%`、`19x19 棋盘`、`4 比 1`、`64 倍提速`）。这些信息应作为父概念节点的子节点的描述性短语：例如 `战胜李世石` 而不是 `4 比 1`，`Atari 游戏基准` 而不是 `49 个 Atari 游戏`
4. 严禁把作者所属机构、期刊卷号、会议名、arxiv 编号、页码等元信息作为节点
5. 专有名词（如 Transformer、DQN、AlphaGo、MoE、Diffusion、CLIP、π/2、BLEU）保持英文 / 数学符号原形，不要翻译为"变压器 / 深度Q网络 / 二分之派"
"""


# ==================== 单次直生成（推荐：上下文够用时使用） ====================


def _build_single_pass_prompt(contents_str: str, language: str, max_depth: int) -> str:
    """单次直生成的 Prompt。借鉴 OG 的 concept-first 风格。"""
    return f"""你是一位经验丰富的知识结构分析师 + 思维导图设计师。请把下面这篇（或这几份）文档读完，然后像人类专家那样画一张层级清晰的思维导图。

## 你应该模拟的"画图思路"
1. **先通读全文，识别真正的主题**：这篇文章在讲哪几个概念 / 方法 / 问题 / 应用？跨章节归并相同主题。
2. **规划主分支（##）**：先在脑中确定 5–8 个能够代表全文的"概念性主分支"，再开始往下展开。一定不要按章节顺序或时间顺序作为主轴。
3. **每个主分支下，挂上具体的命名概念 / 方法 / 子主题（###）**：例如"价值函数方法"下挂 DQN、双重 DQN、Dueling、Rainbow，而不是"算法发展"下挂 2013、2015、2018。
4. **细节、数据、年份做为叶子（####+）**：以"概念→属性"的方式呈现：在某个具体方法节点下，用一行小子节点写"在 Atari 上达到 SOTA"、"训练时长 7 天"等。

{_BRANCH_RULES_ZH}

{_NAMING_RULES_ZH}

## 全文覆盖与均衡硬约束
- **主分支恰好 5–8 个**（不可少于 5 个，也不可多于 8 个）
- **每个主分支下总节点数（含所有子层级）控制在 10–25 个**：超过 25 必须拆分为 2 个独立主分支
- **不能遗漏文章的任何主要主题板块**：包括末尾的局限、未来方向、伦理讨论等（但不要把它们作为名字空泛的"展望 / 总结"主分支，而是融入到对应概念主分支的子节点，或单独命名为内容性主分支如"未解决的可解释性问题"）
- 如果输入是多份文档，必须均衡覆盖每份文档的核心，不要只画其中一篇

## 信息保真硬约束
- 关键定量数据（数字、百分比、金额、年份、指标）必须保留——但作为叶子节点的描述短语，绝不能作为节点名独立成支
- 节点不要"目录化"：每个节点都应该承载具体信息，避免"是什么 / 为什么 / 怎么办"这种空泛三段式
- 重点保留命名概念：模型名、算法名、数据集名、任务名、关键术语

## 整体深度
- 整体最多 {max_depth} 层（# 到 {'#' * max_depth}）
- 根据内容自然展开，不要为了凑层级硬塞节点

## 语言
- 输出节点的文字使用 **{language}** 语言
- 但专有名词（Transformer、DQN、CLIP 等）保持英文原形

## 输出格式
- 纯 Markdown 标题结构（# 根节点，## 主分支，### 子主题，#### 及以下）
- 不要使用代码围栏、列表符号或其他 Markdown 格式
- 不要输出任何解释文字，直接从根节点开始

## 文档内容
{contents_str}

请直接输出 Markdown 思维导图："""


# ==================== 两阶段直生成（用于"分析 → 渲染"） ====================


def _build_analyze_structure_prompt(contents_str: str, language: str, max_depth: int) -> str:
    """两阶段第一步：分析全文，输出层级化知识结构（缩进文本）。"""
    return f"""你是一位资深知识结构分析师。请阅读以下文档（可能是多份），然后输出一份"跨来源综合"的层级化知识结构。这份结构稍后会被渲染为思维导图，所以请严格遵守下面的约束。

## 分析方法
1. **先通读，再综合**：识别真正的主题、概念、方法、应用、关键发现；跨文档把相近主题归并。
2. **规划 5–8 个概念性主分支**，覆盖全文的主要内容板块。
3. **每个主分支下展开命名子概念**，最多 {max_depth} 层。
4. **细节信息（数字、年份、性能指标）**：以子节点形式挂在对应概念下，绝不作为独立分支或独立子节点的主名。

{_BRANCH_RULES_ZH}

{_NAMING_RULES_ZH}

## 输出格式
- 每行一个节点；用缩进（2 空格）表示层级
- 第一行是根节点（不缩进），覆盖全文主旨（≤ 15 字）
- 第二级节点（## 候选）用 2 空格缩进
- 后续层级再加 2 空格
- 不要输出解释文字，不要使用 Markdown 标题符号 #
- 使用 **{language}** 语言（专有名词保持原形）

## 文档内容
{contents_str}

请直接输出层级化知识结构："""


def _build_render_structure_prompt(structure: str, language: str, max_depth: int) -> str:
    """两阶段第二步：把层级化知识结构渲染为 Markdown 思维导图。"""
    return f"""你是一位思维导图设计师。请把下面的"层级化知识结构"渲染为一张 Markdown 标题树形式的思维导图。

## 渲染规则
1. 根节点用 `# `，第二层 `## `，第三层 `### `，依此类推（最多 {max_depth} 层）
2. 严格按照输入结构的层级渲染；可以微调措辞使节点更简洁，但**不要新增 / 删除 / 重排主分支**
3. 节点名 3–12 字短语；专有名词保留原形
4. 不要使用代码围栏，不要输出解释文字
5. 使用 **{language}** 语言

{_NAMING_RULES_ZH}

## 输入：层级化知识结构
{structure}

请直接输出 Markdown 思维导图："""


# ==================== Map 阶段（长文本路径） ====================


def _build_map_prompt(chunk: Dict, language: str, skeleton_json: str = "") -> str:
    """Map 阶段：从单个 chunk 提取 {summary, nodes}。

    skeleton_json：来自 Pre-Plan 阶段的主分支骨架（JSON 数组）；若提供，Map 阶段
    必须尽量将 parent_topic 对齐到骨架的某个主分支名。
    """
    chunk_id = chunk["chunk_id"]
    source = chunk["source"]
    text = chunk["text"]

    lang_instruction = "使用中文" if language == "zh" else f"Use {language} language"

    skeleton_section = ""
    if skeleton_json.strip():
        skeleton_section = f"""
## 全局骨架（来自 Pre-Plan；抽取时对齐）
下面是本文档的主分支骨架。抽取节点时：
- `parent_topic` 字段应当是下面骨架中的某个主分支 `name`（而非 `ROOT`），除非某节点本身就是主分支级概念
- 骨架的 `keywords` 列出了期望归到该分支的关键子概念；如果文本中出现这些关键词，**务必作为独立节点抽出**并挂到对应主分支
- 如果抽取的节点确实不属于任何骨架分支，可以用 `ROOT` 作为 parent_topic，但谨慎判断

{skeleton_json}
"""

    return f"""你是一位知识抽取专家。阅读下面这段文本，先写一段片段摘要，再提取核心命名概念作为节点列表。
{skeleton_section}

## 节点 = 命名概念，不是描述句
- 节点 topic 必须是**命名实体 / 方法名 / 模型名 / 算法名 / 任务名 / 概念名**（3–12 字短语）
- ✅ 正确：`DQN`、`策略梯度`、`AlphaGo`、`元学习`、`扩散模型`、`零样本学习`、`联邦学习`
- ❌ 错误（句子）：`DQN 用经验回放学价值`、`AlphaGo 在 19x19 棋盘上战胜李世石`
- ❌ 错误（数字 / 年份 / 百分比）：`2013 年`、`19x19 棋盘`、`4 比 1`、`76.0%`、`64 倍`、`51 篇综述`
- ❌ 错误（元信息）：`IEEE 期刊`、`MIT 实验室`、`arxiv 编号`、`第 5 章`

## 数字 / 数据如何处理
- 数字、年份、百分比、性能指标、数据集大小等**只能写在 summary 字段里**，绝对不能作为 topic
- 如果一个数据点很重要，把它绑定到对应概念节点的 summary 里（例：节点 `AlphaGo`，summary `2016 年以 4-1 击败李世石，使用 19x19 棋盘和 48 通道特征输入`）

## 父子层级
- parent_topic 可以为 `ROOT` 或上层节点的 topic 字符串
- 同一片段内尽量构建 1–2 层的概念结构：例如 `{{ topic: 'DQN扩展', parent_topic: 'ROOT' }}`、`{{ topic: '双重DQN', parent_topic: 'DQN扩展' }}`

## 重要度评分（段内相对分，1=细节，5=本片段核心）
- 用 importance_score 标记节点在**本片段内**的重要性（不跨片段比较）
- 命名概念默认 ≥ 3；本片段的中心主题 = 5

## 提取数量（精简优先）
- 目标 **12–25 个节点**，命名实体极密时可到 30 个
- 抓住本片段的"主干概念 / 方法族 / 代表性算法"；细枝末节写进 summary 不要展成节点
- 同一方法的多种表述只保留一个 topic
- 不同命名方法不要为压缩数量而合并（`R3Det` 与 `S2A-Net` 必须独立）

## 命名严格约束（违反会导致后续阶段出错）
- topic 必须是**名词性短语**（实体 / 方法名 / 模型名 / 任务名），不得是动词短语、描述句、或性质描述
- ❌ 错误：`由粗到精检测范式`、`空间对齐特征提取`、`分类回归一步完成`、`消除手工 NMS 组件`
- ✅ 正确：`RoI Transformer`、`AlignConv`、`单阶段检测`、`DETR`
- 性质描述、设计特点、工作原理等一律写在 summary，不得作为 topic

## 专有名词
- Transformer / DQN / CLIP / Diffusion / MoE / π/2 / BLEU 等保留英文 / 数学符号原形，不要翻译

## 语言
- summary 字段 {lang_instruction}；topic 字段对中文术语用中文，对英文术语用英文原形

## 输出格式（仅输出合法 JSON 对象，不含任何解释或代码围栏）
{{
  "summary": "2-4 句话的片段摘要，可以包含具体数字",
  "nodes": [
    {{
      "node_id": "{chunk_id}_n0",
      "topic": "命名概念（3-12 字）",
      "parent_topic": "ROOT 或上层 topic",
      "summary": "1-2 句话描述，可包含数字 / 年份 / 性能指标",
      "importance_score": 5,
      "source_chunk_id": "{chunk_id}"
    }}
  ]
}}

## 文本片段（来自: {source}，片段ID: {chunk_id}）
---
{text}
---

请直接输出 JSON 对象："""


def _build_collapse_prompt(group_a_json: str, group_b_json: str, language: str) -> str:
    """Collapse 阶段：合并两组节点。"""
    lang_instruction = "使用中文输出" if language == "zh" else f"Output in {language}"

    return f"""你是知识结构整合专家。请将以下两组节点合并去重。

## 合并原则（保守原则，宁多勿合）
1. **只合并真正同义的节点**：topic 字面完全相同，或同一事物的不同称呼（例：`DQN` 与 `深度Q网络`，`Diffusion` 与 `扩散模型`）
2. **不同方法绝不合并**：即使同属一类，只要 topic 字面不同就保留为独立节点。例如 `R3Det` 与 `S2A-Net` 都是单阶段检测器，但**必须独立保留**；`RSDet` 与 `CSL` 与 `PSC` 都解决 PoA 问题，但**必须独立保留**
3. **不要凭"主题相近"或"功能相似"合并**：除非 topic 字面同义
4. **数据保留**：合并节点时，两侧 summary 中的数字 / 百分比 / 年份必须合并保留在新节点的 summary 中
5. **质量优先，宁多勿合**：合并后节点数大幅缩水（< 输入总数 70%）说明合并过激，请重新检查并保留更多
6. **保持 topic 是命名概念**：不要把节点改成描述句；不要让 topic 变成数字 / 年份
7. **建立父子关系**：若 A 是 B 的子概念，正确设置 parent_topic
8. **node_id**：重新编为 `merged_n0`、`merged_n1`...
9. {lang_instruction}

## 输出格式
仅输出合法 JSON 数组，不含解释或代码围栏。每个节点：
{{"node_id": "merged_nX", "topic": "...", "parent_topic": "ROOT或上级topic", "summary": "...", "importance_score": 1-5, "source_chunk_id": "..."}}

## 节点组 A
{group_a_json}

## 节点组 B
{group_b_json}

请直接输出合并后的 JSON 数组："""


# ==================== Pre-Plan 阶段（NEW v14，Map 之前规划全局骨架） ====================


def _build_pre_plan_prompt(
    headings_md: str,
    excerpt: str,
    language: str,
) -> str:
    """Pre-Plan 阶段：在 Map 之前，仅用标题 + 首尾摘录规划 5–8 个主分支骨架。

    Map 阶段会拿到这个骨架作为对齐参考，让每个 chunk 提取的节点都落到正确分支。
    """
    lang_instruction = "使用中文" if language == "zh" else f"Output in {language}"
    headings_block = headings_md.strip() or "(原文未提供标题结构)"
    excerpt_block = excerpt.strip() or "(无摘录)"

    return f"""你是一位思维导图架构师。请阅读下面的原文标题和首尾摘录，基于你对整篇文档的理解，规划 5–8 个概念性主分支作为全局骨架。

## 输入 A：原文标题结构
{headings_block}

## 输入 B：首尾摘录（帮助你把握主题）
{excerpt_block}

## 你要做的
基于上述信息，决定这份导图的 5–8 个**概念性主分支**。每个主分支需要给出：
1. `name`：主分支名（3–12 字短语；命名概念 / 方法族 / 问题域 / 应用领域）
2. `gist`：一句话描述（≤ 30 字）说明这个分支收什么内容
3. `keywords`：5–12 个该分支下应包含的具体子概念 / 方法名 / 术语（Map 阶段会用它对齐抽取）

{_BRANCH_RULES_ZH}

{_NAMING_RULES_ZH}

## 语言一致性（关键）
- `name` 和 `keywords` 都使用 **{language}** 语言；专有名词（模型名 / 方法名 / 算法缩写如 Transformer / DQN / Mamba）保持英文原形
- 不要为同一概念既给出英文又给出中文翻译（例：`Optical Flow` 与 `光流估计` 不要并列；选其一）
- 通用术语（如 motion compensation、optical flow）翻译为目标语言（运动补偿、光流）；专有方法名（如 Super Slomo、AMT、VFI-Mamba）保留英文

## 注意
- 不要把章节顺序当作主分支顺序；要按"概念重要性 / 内容板块"重新组织
- 跨多个章节的同一主题应合并到同一主分支
- 如果原文有"挑战 / 局限 / 未来"等叙事性章节，把其内容拆解到对应概念主分支，而不是单独建"未来展望"分支
- 这份骨架将指导 Map 阶段从每个 chunk 提取节点；骨架越精准，后续分支越干净
- {lang_instruction}

## 输出格式（仅输出合法 JSON 数组，不含解释或代码围栏）
[
  {{"name": "主分支名", "gist": "一句话描述", "keywords": ["子概念1", "子概念2", ...]}},
  ...
]

请直接输出 JSON 数组："""


# ==================== Plan 阶段（长文本路径） ====================


def _build_plan_prompt(
    chunk_summaries: List[Dict],
    headings_md: str,
    top_topics: List[str],
    language: str,
) -> str:
    """Plan 阶段：基于片段摘要 + 标题骨架 + 高分主题，规划 5–8 个概念性主分支。"""
    lang_instruction = "使用中文" if language == "zh" else f"Output in {language}"

    summary_block = "\n".join(
        f"- [{it.get('chunk_id','')}] {it.get('summary','')}"
        for it in chunk_summaries if it.get("summary")
    ) or "(无可用片段摘要)"

    headings_block = headings_md.strip() or "(原文未提供标题结构)"

    top_topics_block = "\n".join(f"- {t}" for t in top_topics[:60]) if top_topics else "(无)"

    return f"""你是一位思维导图架构师。请阅读下面三类信息，然后规划这张思维导图的"骨架"——5–8 个概念性主分支。

## 输入 A：各片段摘要（按原文顺序）
{summary_block}

## 输入 B：原文标题结构（参考用）
{headings_block}

## 输入 C：候选高分主题（已抽取的命名概念，仅做参考）
{top_topics_block}

## 你要做的
基于上述信息，决定这张导图最重要的 5–8 个**概念性主分支**。每个主分支需要给出：
1. `name`：主分支名（3–12 字短语；命名概念 / 方法族 / 问题域 / 应用领域）
2. `gist`：一句话描述（≤ 30 字）说明这个分支收什么内容
3. `keywords`：3–8 个该分支下应包含的具体子概念 / 方法名（用于 Reduce 阶段对齐）

{_BRANCH_RULES_ZH}

{_NAMING_RULES_ZH}

## 注意
- 不要把章节顺序当作主分支顺序；要按"概念重要性 / 内容板块"重新组织
- 跨多个章节的同一主题应合并到同一主分支
- 如果原文有"挑战 / 局限 / 未来"等叙事性章节，把其内容拆解到对应概念主分支，而不是单独建"未来展望"分支
- {lang_instruction}

## 输出格式（仅输出合法 JSON 数组，不含解释或代码围栏）
[
  {{"name": "主分支名", "gist": "一句话描述", "keywords": ["子概念1", "子概念2", ...]}},
  ...
]

请直接输出 JSON 数组："""


# ==================== Reduce / Populate 阶段（长文本路径） ====================


def _build_reduce_prompt(
    chunk_summaries: List[Dict],
    headings_md: str,
    retained_nodes_json: str,
    language: str,
    max_depth: int,
    skeleton_json: str = "",
    source_excerpt: str = "",
) -> str:
    """Reduce 阶段：根据骨架 + 节点 + 原文摘录 → Markdown 思维导图。

    skeleton_json 来自 Plan 阶段；若提供，必须严格按骨架组织主分支。
    source_excerpt：原文（或首尾摘录）；让 Reduce 有全局视野，避免漏内容。
    """
    lang_instruction = f"使用 {language} 输出" if language != "zh" else "使用中文输出"

    summary_block = "\n".join(
        f"- [{it.get('chunk_id','')}] {it.get('summary','')}"
        for it in chunk_summaries if it.get("summary")
    ) or "(无可用片段摘要)"

    headings_block = headings_md.strip() or "(原文未提供标题结构)"

    skeleton_block = skeleton_json.strip() or "(未提供骨架，请基于摘要 + 标题自己规划 5–8 个主分支)"

    source_section = ""
    if source_excerpt.strip():
        source_section = f"""
## 输入 E：原文（节选；仅用于判断 retained_nodes 中的节点如何归类到 skeleton 分支，不得从中抽取新的节点名）
{source_excerpt}
"""

    return f"""你是一位思维导图设计师。请综合下面信息，生成一份层级清晰的思维导图（Markdown 标题树）。

## 输入 A：主分支骨架（如果提供，必须严格按这个组织 ##）
{skeleton_block}

## 输入 B：各片段摘要（用于把握全文脉络）
{summary_block}

## 输入 C：原文标题结构（仅作参考）
{headings_block}

## 输入 D：保留的命名节点（去重后的命名概念，用作 ### / #### 节点候选）
每项是一个节点：topic / parent_topic / summary / source_chunk_id
{retained_nodes_json}
{source_section}

## 生成规则
1. **根节点**（# 一级标题）：≤ 15 字短语，覆盖全文主旨
2. **主分支**（## 二级标题）：**严格按输入 A 的 skeleton 来**（如果有）；如果没有 skeleton，从摘要中归纳 5–8 个概念性主分支
3. **子层级**（### 三级及以下）：**严格使用 retained_nodes 中的 topic 作为节点名**，按 skeleton 的 keywords + 节点的 parent_topic 关系组织到各主分支下；**严禁从原文摘录新增节点**（原文摘录只用于判断现有节点的正确归属，以及在同义 retained_node 中选最贴近原文表述的 topic）；严禁凭经验或常识"补全"论文未包含的概念（例：如果 retained_nodes 里没有 PolarDet / NWPU VHR-10 / Stable Diffusion，就不要因为你知道它们存在而加进去）
4. **节点名必须是命名实体**：优先来自 retained_nodes 的 topic 字段；**严禁从 summary 中提取描述性短语作为节点名**（错例：`由粗到精检测范式`、`空间对齐特征提取`、`分类回归一步完成`）
5. **节点数紧凑**：总节点数 **60–100 个**（含所有层级）；信息密度取决于概念数，不要堆砌描述
6. **每个 ### 三级节点下挂 2–5 个 #### 具名子节点**（若同类方法很多，使用 4 层分组，不要展成扁平列表）
7. **数据点（数字 / 年份 / 百分比 / 性能指标）不作为节点名**：这些信息只能出现在节点名的后缀修饰（例 `多尺度 mAP 79.3%`）或省略；**严禁单独成节点**（错例：`2023年 TGRS 成果`、`多尺度测试 79.34% mAP`）
8. **严禁同义重复（关键）**：
   - 父子节点不能同名（错：`### Optical Flow` → `#### 光流估计`；`### Diffusion Models` → `#### 扩散模型`）
   - 同概念的英中表述只保留一个（例 `Mamba` / `Mamba-based VFI` / `VFIMamba` 中，前两者是同一概念，必须合并；`VFIMamba` 是具体模型可保留）
   - 通用术语用 {language} 表述（光流、运动补偿）；专有方法名（VFI-Mamba、Super Slomo、AMT）保留英文原形
9. **整体最多 {max_depth} 层**
10. **覆盖性**：每段摘要对应的主题都应在导图中有相应分支
11. {lang_instruction}

{_BRANCH_RULES_ZH}

{_NAMING_RULES_ZH}

## 输出格式
- 纯 Markdown 标题结构：# 根，## 主分支，### 子主题，#### 及以下
- 不使用代码围栏 / 列表符号 / 其他 Markdown
- 不输出解释文字，直接从根节点开始

请直接输出思维导图："""


# ==================== 多文章合并 ====================


def _build_merge_prompt(article_markdowns: List[Dict], language: str, max_depth: int) -> str:
    """多文章合并 Prompt。"""
    lang_instruction = f"使用 {language} 输出" if language != "zh" else "使用中文输出"

    parts = []
    for i, item in enumerate(article_markdowns, 1):
        fn = item.get("filename", f"article_{i}")
        md = item.get("markdown", "").strip()
        parts.append(f"## 文章 {i}：{fn}\n{md}")
    combined = "\n\n".join(parts)

    return f"""你是一位思维导图整合专家。下方给出多份已生成的思维导图，每份对应一篇文章。请将它们合并为一份更大的思维导图。

## 合并规则
1. **新根节点**（#）：覆盖所有文章共同主旨的短语，≤ 20 字
2. **每篇文章降级为主分支**（##）：原文章根节点改为 ##；其下层结构（原 ## 变 ###...）保持原顺序
3. **跨文章主题合并**：如果多篇文章在相近主题上都有分支，可合并为单个主分支（适度，避免过度合并）
4. **主分支数量**：最多 10 个
5. **总节点数**：≤ 200 个
6. **深度上限**：{max_depth} 层
7. **命名风格统一**：3–12 字短语；禁止括号内联；禁止年份 / 数字孤立成节点
8. {lang_instruction}

## 输入
{combined}

## 输出
- 纯 Markdown 标题结构
- 不要使用代码围栏或解释文字
- 直接从根节点开始

请直接输出合并后的思维导图："""


def _build_beautify_prompt(markdown: str, language: str, max_depth: int) -> str:
    """美化 Prompt。"""
    lang_instruction = f"使用 {language} 输出" if language != "zh" else "使用中文输出"
    return f"""你是思维导图润色专家。请对下方思维导图做一次美化。

## 美化要求
1. **结构重平衡**：
   - 主分支（##）控制在 5–8 个
   - 单个主分支下节点总数控制在 10–25 个
   - 整体深度 ≤ {max_depth} 层
2. **命名优化**：
   - 节点 3–12 字短语；删除括号补说；统一风格
   - 数字 / 年份 / 百分比 不能作为节点名独立出现，应作为父节点的描述短语
   - 专有名词（Transformer / DQN 等）保留原形
3. **删除"叙事脚手架"主分支**：背景介绍 / 发展历程 / 章节安排 / 前沿展望 / 总结展望 等空泛分支应改名为具体概念分支，或拆解到对应主分支下
4. **信息保真**：不要删除具体事实和数据，只做结构和命名的重整
5. {lang_instruction}

## 输入
{markdown}

## 输出
- 纯 Markdown 标题结构
- 不使用代码围栏 / 解释文字
- 直接从根节点开始

请直接输出美化后的思维导图："""
