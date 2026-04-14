from __future__ import annotations
import os
import re
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any

import fitz  # PyMuPDF
import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from workflow_engine.workflow.registry import register
from workflow_engine.graphbuilder.graph_builder import GenericGraphBuilder
from workflow_engine.logger import get_logger
from workflow_engine.state import KBMindMapState, MainState
from workflow_engine.agentroles import create_agent
from workflow_engine.utils import get_project_root

log = get_logger(__name__)

# Try importing office libraries
try:
    from docx import Document
except ImportError:
    Document = None

try:
    from pptx import Presentation
except ImportError:
    Presentation = None


# ==================== Token 工具函数 ====================

_encoding_cache: dict[str, tiktoken.Encoding] = {}


def _get_encoding(model: str = "") -> tiktoken.Encoding:
    """获取 tiktoken encoding，缓存复用。"""
    key = model or "_default_"
    if key not in _encoding_cache:
        try:
            _encoding_cache[key] = tiktoken.encoding_for_model(model)
        except (KeyError, Exception):
            _encoding_cache[key] = tiktoken.get_encoding("cl100k_base")
    return _encoding_cache[key]


def _count_tokens(text: str, model: str = "") -> int:
    """精确计算 token 数量。"""
    try:
        return len(_get_encoding(model).encode(text))
    except Exception:
        return len(text) // 3  # fallback


_MODEL_CONTEXT_WINDOWS = {
    "gpt-4": 8192,
    "gpt-4-turbo": 128000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4.1": 1048576,
    "gpt-4.1-mini": 1048576,
    "gpt-4.1-nano": 1048576,
    "o3": 200000,
    "o3-mini": 200000,
    "o4-mini": 200000,
    "deepseek-v3": 64000,
    "deepseek-v3.2": 128000,
    "deepseek-chat": 64000,
    "deepseek-reasoner": 64000,
    "claude-sonnet-4-20250514": 200000,
    "claude-opus-4-20250514": 200000,
    "gemini-2.5-flash": 1048576,
    "gemini-2.5-pro": 1048576,
    "gemini-2.0-flash": 1048576,
    "qwen-plus": 131072,
    "qwen-max": 131072,
    "qwen-turbo": 131072,
}
DEFAULT_CONTEXT_WINDOW = 64000


def _get_context_window(model: str) -> int:
    """查表获取模型上下文窗口大小（最长匹配优先）。"""
    model_lower = model.lower() if model else ""
    best_key, best_val = "", DEFAULT_CONTEXT_WINDOW
    for key, val in _MODEL_CONTEXT_WINDOWS.items():
        if key in model_lower and len(key) > len(best_key):
            best_key, best_val = key, val
    return best_val


def _get_chunk_token_limit(model: str) -> int:
    """计算单次调用 token 上限（上下文 * 0.4）。"""
    return int(_get_context_window(model) * 0.4)


# ==================== JSON 安全解析 ====================

def _parse_json_safe(raw_text: str, chunk_id: str) -> list:
    """多策略解析 LLM 返回的 JSON，带 fallback。"""
    if not raw_text or not raw_text.strip():
        return [_make_fallback_node(chunk_id, "Empty response")]

    text = raw_text.strip()

    # 去除 markdown 代码围栏
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    # 策略 1: 直接解析
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # 策略 2: 正则提取最外层 JSON 数组
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # 策略 3: fallback 节点
    log.warning(f"JSON 解析失败 (chunk={chunk_id})，使用 fallback 节点")
    return [_make_fallback_node(chunk_id, raw_text[:500])]


def _make_fallback_node(chunk_id: str, summary: str) -> dict:
    return {
        "node_id": f"{chunk_id}_fallback",
        "topic": f"Content from {chunk_id}",
        "parent_topic": "ROOT",
        "summary": summary,
        "importance_score": 3,
        "source_chunk_id": chunk_id,
    }


# ==================== Markdown 输出清洗 ====================

def _clean_markdown_output(raw: str) -> str:
    """去除 LLM 输出中可能包裹的代码围栏。"""
    if not raw:
        return "# Error\n## Generation failed"
    if "```" in raw:
        lines = raw.split("\n")
        in_code_block = False
        code_lines = []
        for line in lines:
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                code_lines.append(line)
        if code_lines:
            return "\n".join(code_lines)
    return raw


# ==================== Prompt 模板 ====================

def _build_single_pass_prompt(contents_str: str, language: str, max_depth: int) -> str:
    """单次生成的原始 Prompt（短文本路径）。"""
    return f"""请基于以下文档内容，生成一张层级清晰、主题归纳明确、适合快速把握全文结构的思维导图。你的目标是把文章压缩成一张"知识地图"，让读者能够迅速理解这篇文章的核心主题、主要模块、关键内容，以及各部分之间的层级关系。

请按照下面的方法完成：

先通读全文，识别文章真正的中心主题，用一句高度概括的话作为根节点。这个根节点需要能够覆盖全文主旨，而不是局部内容。输出时将根节点作为**一级标题（#）**呈现。

然后围绕中心主题，提炼出最能代表全文结构的主分支，优先控制在 4–8 个范围内，并将它们作为**二级标题（##）**呈现。主分支要能够代表全文最重要的几个结构板块。请优先从文章本身的结构、论述重心、主题模块、关键信息簇中提炼主分支，使它们能够共同构成全文的主干。

接着在每个主分支下继续拆分 2–4 个子主题，并将它们作为**三级标题（###）**呈现。子主题要承接上级主题，概括该部分最值得保留的核心内容，例如关键概念、主要论点、重要机制、核心步骤、代表性案例、主要证据、结果表现、应用场景、影响因素、行动建议等。

需要时继续向下拆分更细的层级，整体层级最多{max_depth}层（使用 # 到 {'#' * max_depth} 表示）。请根据内容复杂度自然决定展开深度，使层级既完整又紧凑。

**语言要求（必须严格遵守）**：所有输出节点的文字必须使用 **{language}** 语言。无论本提示使用什么语言书写，你输出的思维导图节点内容必须全部使用 {language}。

整张思维导图要体现出一种知识整理型、结构概览型、主题分解型的风格。重点是帮助读者快速理解全文内容版图，而不是只罗列摘要句子。请让结构体现出"从总到分、由主到次、层层展开"的组织逻辑。

请根据文章类型，自适应选择最合适的组织框架：

研究型、分析型文章：背景、问题、核心观点、方法机制、证据结果、意义影响、局限延伸
新闻、时评、纪实型文章：主题事件、背景脉络、关键事实、各方观点、原因影响、趋势走向
科普、说明型文章：核心概念、原理机制、特征表现、应用场景、常见理解、总结启发
教程、方法型文章：目标、前提条件、步骤模块、关键技巧、注意事项、应用建议
商业、产品、行业文章：对象定位、背景环境、核心策略、运行方式、优势价值、风险挑战、发展趋势
访谈、观点型文章：核心立场、主要观点、支撑理由、经验案例、延伸启示

节点命名规则（严格遵守）：
1. 每个节点用 3–12 个字的短语命名，**禁止在节点中使用括号补充说明**
2. 如果需要补充数据或细节，请将其作为下一级子节点单独展开，而不是用括号附在当前节点后
3. 错误示例：`### Grover's Algorithm (O(√n) queries)` — 括号内容应拆分为子节点
4. 正确示例：`### Grover算法` 下设 `#### 时间复杂度 O(√n)`

请将语义接近、作用相同、共同服务于同一主题的信息归并到同一分支下，形成稳定的主题模块。请优先把能够解释全文结构的内容放在上层节点，把例子、数据、条件、补充说明放在下层节点。

特别注意：如果原文包含关键数据、时间、比例、数量、金额、指标或实验结果，请在相关节点中保留这些具体信息，但以子节点形式呈现，而非括号内联。

如果输入中包含多份文档，必须均衡覆盖每份文档的核心内容，不得忽略任何一份文档。每份文档至少应有 1-2 个主分支覆盖其独有的主题。

生成标准：

1. 忠实反映原文主线，保留关键数据和定量结果（以子节点形式）
2. 节点之间要有明确层级关系
3. **分支均衡性硬约束**：每个主分支（##）下的总节点数（包括所有子层级）应控制在 10-25 个之间。如果某个主题预计会产生超过 25 个节点，必须将它拆分为 2-3 个更具体的独立主分支。例如"伦理、风险与监管"应拆分为"伦理争议"、"安全风险"、"政策监管"三个独立主分支
4. **全文覆盖**：不能遗漏文章的任何重要章节或主题板块。先通读全文，识别所有不同的主题领域，确保每个主题领域至少有一个主分支覆盖。特别注意文章末尾的总结、展望、哲学思考等部分不要被忽略
5. 优先保留能够帮助理解全文框架的内容
6. 让整张图看起来像一张"文章结构与知识重点总览图"
7. 读者即使不读原文，也能通过这张导图把握文章的大体结构与核心内容
8. 主分支数量硬性要求 5–8 个，不可少于 5 个，不可多于 8 个

输出格式要求：

1. 使用 Markdown 标题格式：# 根节点，## 主分支，### 子主题，#### 及以下为进一步展开层级
2. 最终结果直接以 Markdown 主体输出，内容从根节点开始展开
3. 采用纯 Markdown 标题结构呈现结果

文档内容：
{contents_str}

请严格按照文档内容前的要求来完成，特别注意：
1. 采用纯 Markdown 标题结构（# ## ### ####），不要使用代码块或其他格式
2. 保留原文中的关键数据、数字和定量信息，以子节点形式呈现
3. 节点简洁有信息量，用短语式表达而非长句，**禁止括号内联**
4. 层级清晰，从总到分、由主到次
5. 主分支必须恰好 5–8 个，每个主分支下的总节点数控制在 10-25 个，超过则拆分为独立主分支
6. 覆盖文章所有重要主题板块，不可遗漏文末的总结、展望、哲学思考等内容
7. **输出语言必须是 {language}**，不可使用其他语言
8. 不要输出任何解释或额外文字，直接从根节点开始输出："""


def _build_map_prompt(chunk: Dict[str, Any], language: str) -> str:
    """Map 阶段 Prompt：从单个 chunk 提取结构化知识节点。"""
    chunk_id = chunk["chunk_id"]
    source = chunk["source"]
    text = chunk["text"]

    lang_instruction = "使用中文" if language == "zh" else f"Use {language} language"

    return f"""你是一位资深知识提炼专家。请阅读以下文本片段，提取其中的核心知识点，并构建结构化的知识节点列表。

## 重要度评分标准（1-5分）
- **5分**：该片段的绝对核心主题或全文中心论点
- **4分**：重要的主干概念、关键方法、核心结论
- **3分**：有价值的支撑论据、重要子概念、关键数据
- **2分**：补充说明、次要例子、背景信息
- **1分**：细枝末节、过渡性文字、重复信息

## 提取要求
1. 根据内容密度提取 8-25 个知识节点，确保充分覆盖片段中的所有重要信息
2. 节点 topic 使用简洁短语（适合放入思维导图）
3. 正确设置 parent_topic 反映层级关系：最顶层节点设为 "ROOT"，子节点指向其上层 topic
4. **定量数据强制保留**：凡是原文中出现的具体数字、年份、百分比、金额、数量、实验数据，必须作为独立节点或写入 summary。例如原文提到 "47% of jobs"，应出现在 topic 或 summary 中。含定量数据的节点 importance_score 至少为 3
5. {lang_instruction}

## 输出格式
仅输出合法的 JSON 数组，不要包含任何解释文字或 Markdown 围栏：
[
  {{
    "node_id": "{chunk_id}_n0",
    "topic": "节点主题（简洁短语）",
    "parent_topic": "ROOT",
    "summary": "1-2句话概括该知识点的核心内容",
    "importance_score": 5,
    "source_chunk_id": "{chunk_id}"
  }},
  ...
]

## 文本片段（来自: {source}，片段ID: {chunk_id}）
---
{text}
---

请直接输出 JSON 数组："""


def _build_collapse_prompt(group_a_json: str, group_b_json: str, language: str) -> str:
    """Collapse 阶段 Prompt：合并两组知识节点。"""
    lang_instruction = "使用中文输出" if language == "zh" else f"Output in {language}"

    return f"""你是一位知识结构整合专家。请将以下两组从相邻文本段落中提取的知识节点合并为一棵更大的知识树。

## 合并规则
1. **去重合并**：将主题相同或高度相似的节点合并为一个，保留更完整的 summary
2. **建立父子关系**：如果一个节点是另一个的子概念（如"深度学习"是"机器学习"的分支），正确设置 parent_topic
3. **重要度校准**：根据合并后的全局视角重新评估 importance_score，确保评分一致性
4. **保守剪枝**：只有在合并后节点总数超过 60 时才进行剪枝，且只移除 importance_score = 1 的纯过渡性节点。宁可保留更多节点，也不要过度精简导致信息丢失
5. **定量数据保护**：topic 或 summary 中包含具体数字、百分比、金额、年份的节点，importance_score 不得低于 3，不得在剪枝中移除。合并节点时，如果被合并的节点含有定量数据，必须将数据保留到合并后节点的 summary 中
6. **保留关键信息**：importance_score ≥ 2 的节点必须保留
7. **主题多样性保护**：parent_topic 为 ROOT 的顶层主题节点不得被合并或删除，以确保最终输出覆盖文档所有方面
8. **重新编号**：node_id 重新编为 "merged_n0", "merged_n1", ...
9. {lang_instruction}

## 输出格式
仅输出合法的 JSON 数组，不要包含任何解释文字或 Markdown 围栏。每个节点格式：
{{"node_id": "merged_nX", "topic": "...", "parent_topic": "ROOT或上级topic", "summary": "...", "importance_score": 1-5, "source_chunk_id": "..."}}

## 节点组 A（前半部分）
{group_a_json}

## 节点组 B（后半部分）
{group_b_json}

请直接输出合并后的 JSON 数组："""


def _build_reduce_prompt(nodes_json: str, language: str, max_depth: int) -> str:
    """Reduce 阶段 Prompt：将结构化节点转为 Markdown heading 思维导图。"""
    return f"""你是一位思维导图设计专家。请根据以下结构化知识节点数据，生成一份逻辑严密、层级分明的思维导图。

## 输入数据说明
下方提供的是从文档中提取并经过多轮合并去重的知识节点，每个节点包含：
- topic：知识点主题
- parent_topic：上级节点（ROOT 表示最顶层）
- summary：内容摘要
- importance_score：重要度（5=核心，1=细节）

## 生成要求
1. 从所有 importance_score=5 的节点中归纳出一个覆盖全文的根节点（# 一级标题），根节点命名控制在 15 字以内
2. 将 importance_score ≥ 4 的节点组织为主分支（## 二级标题），**硬性约束：必须恰好 5-8 个**。生成前先规划好所有主分支标题，确认数量在 5-8 范围内再展开。如果输入节点的顶层主题不足 5 个，请根据内容将较大的主题拆分为更具体的子方向；如果超过 8 个，请将相近主题归并
3. 将 importance_score ≥ 3 的节点分配为子主题（### 三级标题），每个主分支 2-5 个
4. **必须充分利用深度**：importance_score ≥ 2 的节点以及含定量数据的节点，应作为 #### 或更深层级展开。整体最多 {max_depth} 层，目标是至少使用到第 {max_depth - 1} 层
5. 尊重节点间的 parent_topic 层级关系，合理组织树结构
6. 节点命名简洁有信息量，使用 3-12 字短语。**禁止使用括号补充说明**——如需补充数据或细节，作为下一级子节点展开
7. **定量数据必须保留**：节点 summary 中的具体数字、百分比、金额、年份，必须出现在最终思维导图的对应节点中（可作为子节点）。例如：summary 中有 "47% of jobs at risk"，应出现为一个节点
8. **分支均衡性**：各主分支的子节点数量应大致均衡。如果某分支展开后的子节点数量超过最小分支的 3 倍，必须将该分支拆分为 2 个独立主分支
9. **节点充分性**：总节点数应不少于 80 个。每个 importance_score ≥ 2 的输入节点都应在最终导图中有对应体现，不要过度精简
10. 使用{language}语言

## 自适应组织框架
请根据节点内容自动判断文章类型并选择最合适的框架：
- 研究/分析型：背景→问题→核心观点→方法→证据→意义→局限
- 新闻/评论型：事件→背景→事实→观点→原因→趋势
- 科普/说明型：概念→原理→特征→应用→误区→总结
- 教程/方法型：目标→前提→步骤→技巧→注意事项→建议
- 商业/行业型：定位→环境→策略→机制→优势→风险→趋势
- 访谈/观点型：立场→观点→理由→案例→启示

## 输出格式
- 采用纯 Markdown 标题结构：# 根节点，## 主分支，### 子主题，#### 及以下
- 不要使用代码块、列表符号或其他格式
- 不要输出任何解释文字，直接从根节点开始

## 知识节点数据
{nodes_json}

请直接从根节点开始输出思维导图："""


# ==================== 工作流注册 ====================

@register("kb_mindmap")
def create_kb_mindmap_graph() -> GenericGraphBuilder:
    """
    Workflow for Knowledge Base MindMap Generation (MapReduce 增强版)

    短文本路径: _start_ → parse_files → chunk_and_route → generate_single_pass → save_and_end → _end_
    长文本路径: _start_ → parse_files → chunk_and_route → map_phase → collapse_phase ⟲ → reduce_phase → save_and_end → _end_
    """
    builder = GenericGraphBuilder(state_model=KBMindMapState, entry_point="_start_")

    def _extract_text_result(state: MainState, role_name: str) -> str:
        try:
            result = state.agent_results.get(role_name, {}).get("results", {})
            if isinstance(result, dict):
                return result.get("text") or result.get("raw") or ""
            if isinstance(result, str):
                return result
        except Exception:
            return ""
        return ""

    # ==================== 节点函数 ====================

    def _start_(state: KBMindMapState) -> KBMindMapState:
        if not state.request.file_ids:
            state.request.file_ids = []
        if not state.result_path:
            project_root = get_project_root()
            import time
            ts = int(time.time())
            email = getattr(state.request, 'email', 'default')
            output_dir = project_root / "outputs" / "kb_outputs" / email / f"{ts}_mindmap"
            output_dir.mkdir(parents=True, exist_ok=True)
            state.result_path = str(output_dir)
        state.file_contents = []
        state.content_structure = ""
        state.mermaid_code = ""
        state.mindmap_svg_path = ""
        # 重置 MapReduce 状态
        state.use_mapreduce = False
        state.chunks = []
        state.map_results = []
        state.collapsed_nodes = []
        state.collapse_iterations = 0
        state.total_content_tokens = 0
        state.context_window_limit = 0
        return state

    async def parse_files_node(state: KBMindMapState) -> KBMindMapState:
        """解析所有文件，提取文本内容（不截断）。"""
        files = state.request.file_ids
        if not files:
            state.file_contents = []
            return state

        async def process_file(file_path: str) -> Dict[str, Any]:
            file_path_obj = Path(file_path)
            filename = file_path_obj.name
            if not file_path_obj.exists():
                return {"filename": filename, "content": f"[Error: File not found {file_path}]"}

            suffix = file_path_obj.suffix.lower()
            raw_content = ""
            try:
                if suffix == ".pdf":
                    try:
                        doc = fitz.open(file_path)
                        text = ""
                        for page in doc:
                            text += page.get_text() + "\n"
                        raw_content = text
                    except Exception as e:
                        raw_content = f"[Error parsing PDF: {e}]"
                elif suffix in [".docx", ".doc"]:
                    if Document is None:
                        raw_content = "[Error: python-docx not installed]"
                    else:
                        try:
                            doc = Document(file_path)
                            raw_content = "\n".join([p.text for p in doc.paragraphs])
                        except Exception as e:
                            raw_content = f"[Error parsing Docx: {e}]"
                elif suffix in [".pptx", ".ppt"]:
                    if Presentation is None:
                        raw_content = "[Error: python-pptx not installed]"
                    else:
                        try:
                            prs = Presentation(file_path)
                            text = ""
                            for i, slide in enumerate(prs.slides):
                                text += f"--- Slide {i+1} ---\n"
                                for shape in slide.shapes:
                                    if hasattr(shape, "text"):
                                        text += shape.text + "\n"
                            raw_content = text
                        except Exception as e:
                            raw_content = f"[Error parsing PPT: {e}]"
                else:
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            raw_content = f.read()
                    except Exception:
                        raw_content = "[Unsupported file type]"
            except Exception as e:
                raw_content = f"[Parse Error: {e}]"

            return {"filename": filename, "content": raw_content}

        tasks = [process_file(f) for f in files]
        results = await asyncio.gather(*tasks)
        state.file_contents = results
        return state

    async def chunk_and_route_node(state: KBMindMapState) -> KBMindMapState:
        """计算 token 总量，决定走单次路径还是 MapReduce，并完成分块。"""
        if not state.file_contents:
            state.use_mapreduce = False
            return state

        model = state.request.model or ""
        limit = _get_chunk_token_limit(model)
        state.context_window_limit = limit

        # 计算每个文件的 token 数
        file_tokens = []
        total = 0
        for item in state.file_contents:
            tc = _count_tokens(item["content"], model)
            file_tokens.append(tc)
            total += tc
        state.total_content_tokens = total

        log.info(f"[MindMap] 总 token: {total}, 单次上限: {limit}, 文件数: {len(state.file_contents)}")

        if total <= limit:
            state.use_mapreduce = False
            log.info("[MindMap] 走单次生成路径")
            return state

        # MapReduce 路径：构建 chunks
        state.use_mapreduce = True
        log.info(f"[MindMap] 走 MapReduce 路径，开始分块")

        chunks = []
        for i, item in enumerate(state.file_contents):
            content = item["content"]
            tokens = file_tokens[i]

            if tokens <= limit:
                # 整个文件作为一个 chunk
                chunks.append({
                    "chunk_id": f"file{i}_chunk0",
                    "source": item["filename"],
                    "text": content,
                    "token_count": tokens,
                })
            else:
                # 单文件超限，需要切分
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=limit,
                    chunk_overlap=200,
                    length_function=lambda t: _count_tokens(t, model),
                    separators=["\n\n\n", "\n\n", "\n", "。", ".", "；", ";", " ", ""],
                )
                sub_texts = splitter.split_text(content)
                for j, sub in enumerate(sub_texts):
                    chunks.append({
                        "chunk_id": f"file{i}_chunk{j}",
                        "source": item["filename"],
                        "text": sub,
                        "token_count": _count_tokens(sub, model),
                    })

        state.chunks = chunks
        log.info(f"[MindMap] 分块完成，共 {len(chunks)} 个 chunk")
        return state

    def _route_after_chunking(state: KBMindMapState) -> str:
        return "map_phase" if state.use_mapreduce else "generate_single_pass"

    async def generate_single_pass_node(state: KBMindMapState) -> KBMindMapState:
        """短文本路径：与原逻辑一致，单次 LLM 调用生成 Markdown 思维导图。"""
        if not state.file_contents:
            state.mermaid_code = "# Error\n## No content available"
            return state

        contents_str = ""
        for item in state.file_contents:
            contents_str += f"=== {item['filename']} ===\n{item['content']}\n\n"

        prompt = _build_single_pass_prompt(contents_str, state.request.language, state.request.max_depth)

        try:
            agent = create_agent(
                name="kb_prompt_agent",
                model_name=state.request.model,
                chat_api_url=state.request.chat_api_url,
                temperature=0.3,
                parser_type="text",
            )
            temp_state = MainState(request=state.request)
            res_state = await agent.execute(temp_state, prompt=prompt)
            raw = _extract_text_result(res_state, "kb_prompt_agent")
            state.mermaid_code = _clean_markdown_output(raw)
        except Exception as e:
            log.error(f"[MindMap] 单次生成失败: {e}")
            state.mermaid_code = f"# Error\n## {str(e)}"

        return state

    async def map_phase_node(state: KBMindMapState) -> KBMindMapState:
        """Map 阶段：并行提取每个 chunk 的局部知识节点 JSON。"""
        language = state.request.language

        async def process_chunk(chunk: Dict[str, Any]) -> Dict[str, Any]:
            prompt = _build_map_prompt(chunk, language)
            try:
                agent = create_agent(
                    name="kb_prompt_agent",
                    model_name=state.request.model,
                    chat_api_url=state.request.chat_api_url,
                    temperature=0.2,
                    parser_type="text",
                )
                temp_state = MainState(request=state.request)
                res_state = await agent.execute(temp_state, prompt=prompt)
                raw = _extract_text_result(res_state, "kb_prompt_agent")
                nodes = _parse_json_safe(raw, chunk["chunk_id"])
            except Exception as e:
                log.error(f"[MindMap Map] chunk {chunk['chunk_id']} 失败: {e}")
                nodes = [_make_fallback_node(chunk["chunk_id"], str(e))]
            return {"chunk_id": chunk["chunk_id"], "nodes": nodes}

        log.info(f"[MindMap Map] 开始并行处理 {len(state.chunks)} 个 chunk")
        tasks = [process_chunk(c) for c in state.chunks]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        map_results = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                cid = state.chunks[i]["chunk_id"]
                log.error(f"[MindMap Map] chunk {cid} 异常: {r}")
                map_results.append({"chunk_id": cid, "nodes": [_make_fallback_node(cid, str(r))]})
            else:
                map_results.append(r)

        state.map_results = map_results

        total_nodes = sum(len(r["nodes"]) for r in map_results)
        log.info(f"[MindMap Map] 完成，共提取 {total_nodes} 个节点")
        return state

    async def collapse_phase_node(state: KBMindMapState) -> KBMindMapState:
        """Collapse 阶段：迭代合并节点列表，直到 token 量可控。"""
        model = state.request.model or ""
        language = state.request.language
        limit = state.context_window_limit

        # 首次进入：从 map_results 收集所有节点
        if not state.collapsed_nodes:
            all_nodes = []
            for mr in state.map_results:
                all_nodes.extend(mr.get("nodes", []))
            state.collapsed_nodes = all_nodes

        serialized = json.dumps(state.collapsed_nodes, ensure_ascii=False)
        current_tokens = _count_tokens(serialized, model)
        log.info(f"[MindMap Collapse] 轮次 {state.collapse_iterations}, 节点数 {len(state.collapsed_nodes)}, token {current_tokens}/{limit}")

        if current_tokens <= limit:
            log.info("[MindMap Collapse] 已在上限内，进入 Reduce")
            return state

        state.collapse_iterations += 1

        # 按 token 量将节点列表分组为若干对
        groups = _split_nodes_into_groups(state.collapsed_nodes, limit, model)
        log.info(f"[MindMap Collapse] 分为 {len(groups)} 组进行合并")

        async def merge_pair(a: list, b: list) -> list:
            a_json = json.dumps(a, ensure_ascii=False)
            b_json = json.dumps(b, ensure_ascii=False)
            prompt = _build_collapse_prompt(a_json, b_json, language)
            try:
                agent = create_agent(
                    name="kb_prompt_agent",
                    model_name=model,
                    chat_api_url=state.request.chat_api_url,
                    temperature=0.2,
                    parser_type="text",
                )
                temp_state = MainState(request=state.request)
                res_state = await agent.execute(temp_state, prompt=prompt)
                raw = _extract_text_result(res_state, "kb_prompt_agent")
                return _parse_json_safe(raw, "collapse")
            except Exception as e:
                log.error(f"[MindMap Collapse] 合并失败: {e}")
                return a + b  # fallback: 不合并，原样返回

        # 两两配对并行合并
        merge_tasks = []
        for i in range(0, len(groups) - 1, 2):
            merge_tasks.append(merge_pair(groups[i], groups[i + 1]))

        merge_results = await asyncio.gather(*merge_tasks, return_exceptions=True)

        merged = []
        for r in merge_results:
            if isinstance(r, Exception):
                log.error(f"[MindMap Collapse] 合并异常: {r}")
            else:
                merged.extend(r)

        # 如果组数为奇数，最后一组直通
        if len(groups) % 2 == 1:
            merged.extend(groups[-1])

        state.collapsed_nodes = merged
        log.info(f"[MindMap Collapse] 合并后节点数: {len(merged)}")
        return state

    def _route_after_collapse(state: KBMindMapState) -> str:
        if state.collapse_iterations >= 5:
            log.warning("[MindMap] Collapse 达到最大轮次，强制进入 Reduce")
            return "reduce_phase"
        serialized = json.dumps(state.collapsed_nodes, ensure_ascii=False)
        tokens = _count_tokens(serialized, state.request.model or "")
        if tokens <= state.context_window_limit:
            return "reduce_phase"
        return "collapse_phase"

    async def reduce_phase_node(state: KBMindMapState) -> KBMindMapState:
        """Reduce 阶段：将合并后的结构化节点转为 Markdown heading 思维导图。"""
        nodes_json = json.dumps(state.collapsed_nodes, ensure_ascii=False)
        prompt = _build_reduce_prompt(nodes_json, state.request.language, state.request.max_depth)

        log.info(f"[MindMap Reduce] 节点数 {len(state.collapsed_nodes)}，开始生成最终思维导图")

        try:
            agent = create_agent(
                name="kb_prompt_agent",
                model_name=state.request.model,
                chat_api_url=state.request.chat_api_url,
                temperature=0.3,
                parser_type="text",
            )
            temp_state = MainState(request=state.request)
            res_state = await agent.execute(temp_state, prompt=prompt)
            raw = _extract_text_result(res_state, "kb_prompt_agent")
            state.mermaid_code = _clean_markdown_output(raw)
        except Exception as e:
            log.error(f"[MindMap Reduce] 生成失败: {e}")
            state.mermaid_code = f"# Error\n## {str(e)}"

        return state

    async def save_and_end_node(state: KBMindMapState) -> KBMindMapState:
        """保存最终的 Markdown 思维导图到文件。"""
        try:
            mermaid_path = Path(state.result_path) / "mindmap.mmd"
            mermaid_path.write_text(state.mermaid_code, encoding="utf-8")
            log.info(f"[MindMap] 思维导图已保存: {mermaid_path}")
        except Exception as e:
            log.error(f"[MindMap] 保存失败: {e}")
        return state

    # ==================== 辅助函数 ====================

    def _split_nodes_into_groups(nodes: list, token_limit: int, model: str) -> List[list]:
        """将节点列表按 token 量分组，每组不超过 token_limit * 0.45（留空间给 prompt + 输出）。"""
        group_limit = int(token_limit * 0.45)
        groups = []
        current_group = []
        current_tokens = 0

        for node in nodes:
            node_json = json.dumps(node, ensure_ascii=False)
            node_tokens = _count_tokens(node_json, model)

            if current_group and current_tokens + node_tokens > group_limit:
                groups.append(current_group)
                current_group = [node]
                current_tokens = node_tokens
            else:
                current_group.append(node)
                current_tokens += node_tokens

        if current_group:
            groups.append(current_group)

        # 确保至少有 2 组才有合并意义；如果只有 1 组则强制对半拆分
        if len(groups) == 1 and len(groups[0]) > 1:
            mid = len(groups[0]) // 2
            groups = [groups[0][:mid], groups[0][mid:]]

        return groups

    # ==================== 构建图 ====================

    nodes = {
        "_start_": _start_,
        "parse_files": parse_files_node,
        "chunk_and_route": chunk_and_route_node,
        "generate_single_pass": generate_single_pass_node,
        "map_phase": map_phase_node,
        "collapse_phase": collapse_phase_node,
        "reduce_phase": reduce_phase_node,
        "save_and_end": save_and_end_node,
        "_end_": lambda s: s,
    }

    edges = [
        ("_start_", "parse_files"),
        ("parse_files", "chunk_and_route"),
        # chunk_and_route 通过条件边路由
        ("generate_single_pass", "save_and_end"),
        ("map_phase", "collapse_phase"),
        # collapse_phase 通过条件边路由（循环或进入 reduce）
        ("reduce_phase", "save_and_end"),
        ("save_and_end", "_end_"),
    ]

    builder.add_nodes(nodes).add_edges(edges)
    builder.add_conditional_edge("chunk_and_route", _route_after_chunking)
    builder.add_conditional_edge("collapse_phase", _route_after_collapse)
    return builder
