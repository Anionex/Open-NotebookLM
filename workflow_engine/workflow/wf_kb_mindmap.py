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
from workflow_engine.workflow.prompts_kb_mindmap import (
    _build_single_pass_prompt,
    _build_analyze_structure_prompt,
    _build_render_structure_prompt,
    _build_map_prompt,
    _build_collapse_prompt,
    _build_plan_prompt,
    _build_pre_plan_prompt,
    _build_reduce_prompt,
    _build_merge_prompt,
    _build_beautify_prompt,
)
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
    "gemini-3-flash": 1048576,
    "gemini-3-pro": 1048576,
    "gemini-3": 1048576,
    "gpt-5": 400000,
    "qwen-plus": 131072,
    "qwen-max": 131072,
    "qwen-turbo": 131072,
}
DEFAULT_CONTEXT_WINDOW = 64000

# 长文本临界比例：
# - 路由：单篇 tokens >= LONG_TEXT_THRESHOLD_RATIO * ctx → 走 MapReduce
# - Chunk 切分：单 chunk 上限 = LONG_TEXT_THRESHOLD_RATIO * ctx
# - Collapse 目标：保留节点 json 序列化 tokens ≤ LONG_TEXT_THRESHOLD_RATIO * ctx
LONG_TEXT_THRESHOLD_RATIO = 0.6

# Collapse 轮次上限，防止估算偏差下死循环
MAX_COLLAPSE_ITERATIONS = 5


def _get_context_window(model: str) -> int:
    """查表获取模型上下文窗口大小（最长匹配优先）。"""
    model_lower = model.lower() if model else ""
    best_key, best_val = "", DEFAULT_CONTEXT_WINDOW
    for key, val in _MODEL_CONTEXT_WINDOWS.items():
        if key in model_lower and len(key) > len(best_key):
            best_key, best_val = key, val
    return best_val


def _get_chunk_token_limit(model: str) -> int:
    """计算长文本临界（上下文 * LONG_TEXT_THRESHOLD_RATIO）。

    支持 env 覆盖（bench 强制 MR 用）：
    - MINDMAP_FORCE_CHUNK_LIMIT=<int>：直接指定 token 阈值
    - MINDMAP_THRESHOLD_RATIO=<float>：覆盖 LONG_TEXT_THRESHOLD_RATIO
    """
    forced = os.getenv("MINDMAP_FORCE_CHUNK_LIMIT")
    if forced:
        return int(forced)
    ratio_env = os.getenv("MINDMAP_THRESHOLD_RATIO")
    ratio = float(ratio_env) if ratio_env else LONG_TEXT_THRESHOLD_RATIO
    return int(_get_context_window(model) * ratio)


# ==================== JSON 安全解析 ====================

def _strip_code_fences(text: str) -> str:
    """去除 markdown 代码围栏（```json ... ```）。"""
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        t = "\n".join(lines).strip()
    return t


def _parse_json_safe(raw_text: str, chunk_id: str) -> list:
    """多策略解析 LLM 返回的 JSON 数组（collapse 等场景），带 fallback。"""
    if not raw_text or not raw_text.strip():
        return [_make_fallback_node(chunk_id, "Empty response")]

    text = _strip_code_fences(raw_text)

    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and isinstance(result.get("nodes"), list):
            return result["nodes"]
    except json.JSONDecodeError:
        pass

    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    log.warning(f"JSON 解析失败 (chunk={chunk_id})，使用 fallback 节点")
    return [_make_fallback_node(chunk_id, raw_text[:500])]


def _parse_map_json_safe(raw_text: str, chunk_id: str) -> dict:
    """
    Map 阶段输出：{"summary": "...", "nodes": [...]}
    兼容三种返回：完整 dict / 纯 list（仅 nodes）/ 解析失败。
    """
    empty_fallback = {"summary": "", "nodes": [_make_fallback_node(chunk_id, "Empty response")]}
    if not raw_text or not raw_text.strip():
        return empty_fallback

    text = _strip_code_fences(raw_text)

    try:
        result = json.loads(text)
        if isinstance(result, dict):
            nodes = result.get("nodes") or []
            if not isinstance(nodes, list):
                nodes = []
            if not nodes:
                nodes = [_make_fallback_node(chunk_id, "Empty nodes")]
            return {"summary": str(result.get("summary", "")).strip(), "nodes": nodes}
        if isinstance(result, list):
            return {"summary": "", "nodes": result or [_make_fallback_node(chunk_id, "Empty list")]}
    except json.JSONDecodeError:
        pass

    # 回退：尝试提取 nodes 数组
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            nodes = json.loads(match.group())
            if isinstance(nodes, list) and nodes:
                return {"summary": "", "nodes": nodes}
        except json.JSONDecodeError:
            pass

    log.warning(f"Map JSON 解析失败 (chunk={chunk_id})，使用 fallback")
    return {"summary": "", "nodes": [_make_fallback_node(chunk_id, raw_text[:500])]}


# ==================== 节点名净化（demote 数字 / 年份 / 百分比） ====================

_BAD_TOPIC_PATTERNS = [
    re.compile(r"^\s*\d{4}\s*年?\s*$"),                          # 2013, 2013年
    re.compile(r"^\s*\d+(\.\d+)?\s*%\s*$"),                      # 76.0%
    re.compile(r"^\s*\d+(\.\d+)?\s*(倍|次|篇|个|项|章|节|页|卷|期)\s*$"),
    re.compile(r"^\s*\$\s*\d+(\.\d+)?\s*$"),                     # $100
    re.compile(r"^\s*\d+\s*[xX×]\s*\d+\s*$"),                    # 19x19 (无后续文字)
    re.compile(r"^\s*\d+\s*[-\u2013:：]\s*\d+\s*$"),             # 4-1, 4:1
    re.compile(r"^[\s\d\.,\-:：%年月日]+$"),                      # 纯数字/标点/年月日
]

_BAD_TOPIC_KEYWORDS = {
    "引言", "简介", "概述", "背景", "研究背景", "文章结构", "章节概览", "章节安排",
    "致谢", "参考文献", "附录", "索引", "图表目录",
    "研究方法", "研究内容", "主要内容", "主要贡献", "论文组织", "论文结构",
    "arxiv 编号", "IEEE", "期刊", "作者信息",
}


def _is_bad_topic(topic: str) -> bool:
    """检测 topic 是否是纯数字 / 年份 / 百分比 / 元信息（这类不应作为节点名）。"""
    if not topic:
        return True
    t = topic.strip()
    if not t:
        return True
    for pat in _BAD_TOPIC_PATTERNS:
        if pat.match(t):
            return True
    if t in _BAD_TOPIC_KEYWORDS:
        return True
    return False


def _sanitize_nodes(nodes: List[dict]) -> List[dict]:
    """把 topic 为数字 / 年份 / 百分比 / 空泛容器词的节点剔除（其信息合并到 parent 的 summary）。"""
    if not nodes:
        return nodes
    topic_to_idx = {n.get("topic", "").strip(): i for i, n in enumerate(nodes)}
    good: List[dict] = []
    bad_count = 0
    for n in nodes:
        topic = str(n.get("topic", "")).strip()
        if _is_bad_topic(topic):
            bad_count += 1
            parent = str(n.get("parent_topic", "")).strip()
            if parent and parent != "ROOT" and parent in topic_to_idx:
                pidx = topic_to_idx[parent]
                if pidx < len(nodes):
                    parent_node = nodes[pidx]
                    extra = n.get("summary", "") or topic
                    if extra:
                        cur = str(parent_node.get("summary", "")).strip()
                        parent_node["summary"] = (cur + (" " if cur else "") + str(extra)).strip()
            continue
        good.append(n)
    if bad_count:
        log.info(f"[Sanitize] 剔除 {bad_count} 个数字/年份/空壳节点")
    return good


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


# ==================== Markdown → Mermaid 转换 ====================

_MERMAID_ESCAPE_RE = re.compile(r"[()\[\]{}<>\"'/\\,;:!?]")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)")


def _mermaid_needs_escape(text: str) -> bool:
    return bool(_MERMAID_ESCAPE_RE.search(text))


def markdown_to_mermaid(markdown: str) -> str:
    """
    把 Markdown 标题树（# ## ### ####）转换为 Mermaid mindmap 语法。
    与 frontend_en/src/utils/mermaidToMarkdown.ts 保持一致的转换规则。
    """
    if not markdown:
        return "mindmap\n  root((Mindmap))"

    lines = markdown.split("\n")
    out = ["mindmap"]
    node_id = 0

    for line in lines:
        m = _HEADING_RE.match(line)
        if not m:
            continue
        depth = len(m.group(1))
        text = m.group(2).strip()
        indent = "  " * depth

        if depth == 1:
            if _mermaid_needs_escape(text):
                out.append(f'{indent}root["{text}"]')
            else:
                out.append(f"{indent}root({text})")
        else:
            if _mermaid_needs_escape(text):
                node_id += 1
                out.append(f'{indent}n{node_id}["{text}"]')
            else:
                out.append(f"{indent}{text}")

    if len(out) == 1:
        out.append("  root((Mindmap))")

    return "\n".join(out)


def _extract_md_headings(content: str, max_level: int = 3) -> str:
    """从 markdown 内容抽取前 max_level 级标题树，返回原样 markdown 片段。"""
    if not content:
        return ""
    lines = []
    for line in content.split("\n"):
        m = _HEADING_RE.match(line)
        if not m:
            continue
        depth = len(m.group(1))
        if depth > max_level:
            continue
        lines.append(f"{'#' * depth} {m.group(2).strip()}")
    return "\n".join(lines)


# ==================== 工作流注册 ====================

@register("kb_mindmap")
def create_kb_mindmap_graph() -> GenericGraphBuilder:
    """
    Workflow for Knowledge Base MindMap Generation (v7: per-article + smart-collapse)

    _start_ → parse_files → process_articles → merge_articles → beautify → save_and_end → _end_

    process_articles 内部对每篇文章按 LONG_TEXT_THRESHOLD_RATIO 路由：
      tokens < 阈值 → _run_article_direct（单次 LLM）
      tokens ≥ 阈值 → _run_article_mapreduce（Map → Smart Collapse → Reduce）
    merge_articles：≥2 篇则 LLM 合并；1 篇直通。
    beautify：request.beautify=True 时做结构重平衡 + 命名优化，否则直通。
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

    # ==================== 调试中间产物保存 ====================

    def _save_debug(state: KBMindMapState, filename: str, data: Any) -> None:
        """将中间产物保存到 result_path/debug/ 目录，便于调试。"""
        try:
            debug_dir = Path(state.result_path) / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            filepath = debug_dir / filename
            if isinstance(data, (dict, list)):
                filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            else:
                filepath.write_text(str(data), encoding="utf-8")
            log.info(f"[MindMap Debug] 已保存: {filepath}")
        except Exception as e:
            log.warning(f"[MindMap Debug] 保存失败 {filename}: {e}")

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
        # 重置 MapReduce 状态（v7 主要使用 per_article_results；保留旧字段向后兼容）
        state.use_mapreduce = False
        state.chunks = []
        state.map_results = []
        state.collapsed_nodes = []
        state.collapse_iterations = 0
        state.total_content_tokens = 0
        state.context_window_limit = 0
        state.per_article_results = []
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

    # ==================== LLM 调用辅助 ====================

    async def _call_llm(prompt: str, state: KBMindMapState, temperature: float = 0.3) -> str:
        agent = create_agent(
            name="kb_prompt_agent",
            model_name=state.request.model,
            chat_api_url=state.request.chat_api_url,
            temperature=temperature,
            parser_type="text",
        )
        temp_state = MainState(request=state.request)
        res_state = await agent.execute(temp_state, prompt=prompt)
        return _extract_text_result(res_state, "kb_prompt_agent")

    # ==================== Smart Collapse 辅助 ====================

    def _tokens_of_nodes(nodes: List[dict], model: str) -> int:
        return _count_tokens(json.dumps(nodes, ensure_ascii=False), model)

    def _pair_adjacent(nodes: List[dict], target_pair_size: int) -> List[List[List[dict]]]:
        """
        将节点按原顺序每 target_pair_size*2 个切成一组，组内拆成 A/B 两半。
        返回 [[group_a, group_b], ...]，供并发 collapse 调用。
        """
        pair_span = max(2, target_pair_size) * 2
        pairs: List[List[List[dict]]] = []
        for i in range(0, len(nodes), pair_span):
            window = nodes[i:i + pair_span]
            if len(window) < 2:
                continue
            mid = len(window) // 2
            pairs.append([window[:mid], window[mid:]])
        return pairs

    def _estimate_pairs_needed(
        pairs: List[List[List[dict]]],
        deficit: int,
        model: str,
    ) -> int:
        """
        按"每对合并后 ≈ 原 2/3 tokens"估算需要多少对才能覆盖 deficit。
        返回至少为 1，至多为 len(pairs)。
        """
        if deficit <= 0 or not pairs:
            return 0
        cumulative_saved = 0
        for idx, (a, b) in enumerate(pairs, 1):
            pair_tokens = _tokens_of_nodes(a + b, model)
            saved = int(pair_tokens * (1 / 3))
            cumulative_saved += saved
            if cumulative_saved >= deficit:
                return idx
        return len(pairs)

    async def _merge_pair(a: list, b: list, state: KBMindMapState) -> list:
        prompt = _build_collapse_prompt(
            json.dumps(a, ensure_ascii=False),
            json.dumps(b, ensure_ascii=False),
            state.request.language,
        )
        try:
            raw = await _call_llm(prompt, state, temperature=0.2)
            return _parse_json_safe(raw, "collapse")
        except Exception as e:
            log.error(f"[MindMap Collapse] 合并失败: {e}")
            return a + b  # 保底：不合并

    async def _smart_collapse(
        article_name: str,
        flat_nodes: List[dict],
        limit: int,
        state: KBMindMapState,
    ) -> List[dict]:
        """
        智能 Collapse：按需合并直到 tokens(nodes) ≤ limit。
        - 每轮估算需要合并的对数，并发预合并这些对
        - 按序应用合并结果，实际达到目标即停，丢弃剩余未应用对
        - 至多 MAX_COLLAPSE_ITERATIONS 轮
        """
        model = state.request.model or ""
        nodes = list(flat_nodes)
        rounds = 0
        while True:
            cur_tokens = _tokens_of_nodes(nodes, model)
            if cur_tokens <= limit:
                log.info(f"[Collapse {article_name}] 已在阈值内 ({cur_tokens}/{limit})，停止")
                return nodes
            if rounds >= MAX_COLLAPSE_ITERATIONS:
                log.warning(f"[Collapse {article_name}] 达到最大轮次 {MAX_COLLAPSE_ITERATIONS}，强制返回")
                return nodes

            rounds += 1
            deficit = cur_tokens - limit
            avg = max(1, cur_tokens // max(len(nodes), 1))
            # 每对目标节点数：让每对合并后的产物大约是 limit 的 1/8（使得 ~8 对可铺满）
            target_pair_size = max(2, int(limit / avg / 8))
            pairs = _pair_adjacent(nodes, target_pair_size)
            if not pairs:
                log.warning(f"[Collapse {article_name}] 无可配对节点，退出")
                return nodes

            est = _estimate_pairs_needed(pairs, deficit, model)
            candidates = pairs[:max(1, est)]
            log.info(
                f"[Collapse {article_name}] 轮 {rounds}: nodes={len(nodes)} tokens={cur_tokens}/{limit} "
                f"deficit={deficit} pairs_total={len(pairs)} pre_merge={len(candidates)}"
            )

            # 并发预合并
            merged_results = await asyncio.gather(
                *[_merge_pair(a, b, state) for (a, b) in candidates],
                return_exceptions=True,
            )

            # 按序应用，实际达标即停
            next_nodes: List[dict] = []
            applied = 0
            consumed_span = 0  # 已被合并吞掉的原始节点范围
            pair_span = max(2, target_pair_size) * 2
            for i, merged in enumerate(merged_results):
                start = i * pair_span
                end = min(start + pair_span, len(nodes))
                if isinstance(merged, Exception) or not isinstance(merged, list):
                    next_nodes.extend(nodes[start:end])
                    consumed_span = end
                    continue
                # 先尝试应用这一对合并结果，看是否已经达标
                tentative = next_nodes + list(merged) + nodes[end:]
                tentative_tokens = _tokens_of_nodes(tentative, model)
                next_nodes.extend(merged)
                applied += 1
                consumed_span = end
                if tentative_tokens <= limit:
                    # 已达标，剩余对不再应用——其原节点直接保留
                    next_nodes.extend(nodes[end:])
                    consumed_span = len(nodes)
                    break

            # 若未覆盖完所有原始节点（候选对之外的尾部），补齐
            if consumed_span < len(nodes):
                next_nodes.extend(nodes[consumed_span:])

            log.info(
                f"[Collapse {article_name}] 轮 {rounds}: applied={applied}/{len(candidates)}, "
                f"nodes {len(nodes)} → {len(next_nodes)}"
            )
            _save_debug(state, f"03_collapse_{article_name}_round{rounds}.json", next_nodes)
            nodes = next_nodes

    # ==================== Per-article 内部管线 ====================

    async def _run_article_direct(article: Dict[str, Any], state: KBMindMapState) -> str:
        """短文本 direct 路径：两阶段 analyze → render（人类画图思路）。"""
        contents_str = f"=== {article['filename']} ===\n{article['content']}\n\n"
        language = state.request.language
        max_depth = state.request.max_depth
        article_name = re.sub(r"[^\w\-]", "_", article["filename"])[:40]

        # 阶段 1：分析全文 → 层级化知识结构（缩进文本）
        try:
            analyze_prompt = _build_analyze_structure_prompt(contents_str, language, max_depth)
            structure = await _call_llm(analyze_prompt, state, temperature=0.3)
            structure = (structure or "").strip()
            _save_debug(state, f"direct_01_structure_{article_name}.txt", structure)
        except Exception as e:
            log.error(f"[Direct Analyze] {article['filename']} 失败: {e}")
            structure = ""

        # 阶段 2：渲染为 Markdown 思维导图
        if not structure:
            # fallback：单次直接生成
            prompt = _build_single_pass_prompt(contents_str, language, max_depth)
            try:
                raw = await _call_llm(prompt, state, temperature=0.3)
                return _clean_markdown_output(raw)
            except Exception as e:
                log.error(f"[Direct Single] {article['filename']} 失败: {e}")
                return f"# {article['filename']}\n## Error\n### {e}"

        try:
            render_prompt = _build_render_structure_prompt(structure, language, max_depth)
            raw = await _call_llm(render_prompt, state, temperature=0.2)
            md = _clean_markdown_output(raw)
            _save_debug(state, f"direct_02_markdown_{article_name}.md", md)
            return md
        except Exception as e:
            log.error(f"[Direct Render] {article['filename']} 失败: {e}")
            return f"# {article['filename']}\n## Error\n### {e}"

    def _chunk_article(article: Dict[str, Any], limit: int, model: str) -> List[Dict[str, Any]]:
        content = article["content"]
        tokens = _count_tokens(content, model)
        source = article["filename"]
        if tokens <= limit:
            return [{
                "chunk_id": f"{article['_file_idx']}_chunk0",
                "source": source,
                "text": content,
                "token_count": tokens,
            }]
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=limit,
            chunk_overlap=200,
            length_function=lambda t: _count_tokens(t, model),
            separators=["\n\n\n", "\n\n", "\n", "。", ".", "；", ";", " ", ""],
        )
        sub_texts = splitter.split_text(content)
        return [
            {
                "chunk_id": f"{article['_file_idx']}_chunk{j}",
                "source": source,
                "text": sub,
                "token_count": _count_tokens(sub, model),
            }
            for j, sub in enumerate(sub_texts)
        ]

    async def _run_article_mapreduce(
        article: Dict[str, Any],
        state: KBMindMapState,
        limit: int,
    ) -> Dict[str, Any]:
        """长文本 MapReduce 路径。返回 {markdown, chunk_summaries, retained_nodes, headings}。"""
        model = state.request.model or ""
        language = state.request.language
        article_name = re.sub(r"[^\w\-]", "_", article["filename"])[:40]

        chunks = _chunk_article(article, limit, model)
        log.info(f"[MapReduce {article_name}] 分块 {len(chunks)} 个")

        # ---- Pre-Plan：用标题 + 首尾摘录在 Map 之前规划骨架 ----
        headings_md = _extract_md_headings(article["content"]) if article["filename"].lower().endswith(".md") else ""
        _content_str = article["content"]
        _head_tok = 3000
        _tail_tok = 2000
        # 粗略按字符取首尾摘录（不调 tiktoken，避免 Map 前再额外耗时）
        _head_chars = _head_tok * 4
        _tail_chars = _tail_tok * 4
        if len(_content_str) > _head_chars + _tail_chars + 500:
            excerpt = _content_str[:_head_chars] + "\n\n[... 中间省略 ...]\n\n" + _content_str[-_tail_chars:]
        else:
            excerpt = _content_str

        pre_plan_skeleton_json = ""
        try:
            pre_prompt = _build_pre_plan_prompt(headings_md, excerpt, language)
            raw = await _call_llm(pre_prompt, state, temperature=0.2)
            pre_parsed = _parse_json_safe(raw, f"pre_plan_{article_name}")
            if isinstance(pre_parsed, list) and pre_parsed:
                pre_plan_skeleton_json = json.dumps(pre_parsed, ensure_ascii=False, indent=2)
            _save_debug(state, f"01b_pre_plan_{article_name}.json", pre_parsed if pre_parsed else raw)
            log.info(f"[Pre-Plan {article_name}] 骨架 {len(pre_parsed) if isinstance(pre_parsed, list) else '?'} 个主分支")
        except Exception as e:
            log.error(f"[Pre-Plan {article_name}] 失败（降级为无骨架 Map）: {e}")

        # ---- Map ----
        async def process_chunk(chunk: Dict[str, Any]) -> Dict[str, Any]:
            prompt = _build_map_prompt(chunk, language, skeleton_json=pre_plan_skeleton_json)
            try:
                raw = await _call_llm(prompt, state, temperature=0.2)
                parsed = _parse_map_json_safe(raw, chunk["chunk_id"])
            except Exception as e:
                log.error(f"[Map {article_name}] chunk {chunk['chunk_id']} 失败: {e}")
                parsed = {"summary": "", "nodes": [_make_fallback_node(chunk["chunk_id"], str(e))]}
            parsed["chunk_id"] = chunk["chunk_id"]
            return parsed

        map_tasks = [process_chunk(c) for c in chunks]
        map_results_raw = await asyncio.gather(*map_tasks, return_exceptions=True)
        map_results: List[Dict[str, Any]] = []
        for i, r in enumerate(map_results_raw):
            if isinstance(r, Exception):
                cid = chunks[i]["chunk_id"]
                log.error(f"[Map {article_name}] chunk {cid} 异常: {r}")
                map_results.append({"chunk_id": cid, "summary": "", "nodes": [_make_fallback_node(cid, str(r))]})
            else:
                map_results.append(r)
        _save_debug(state, f"02_map_results_{article_name}.json", map_results)
        log.info(f"[Map {article_name}] 完成，节点总数 {sum(len(r['nodes']) for r in map_results)}")

        # ---- Smart Collapse ----
        flat_nodes: List[dict] = []
        for mr in map_results:
            flat_nodes.extend(mr.get("nodes", []))
        # 先净化：去掉 Map 阶段漏网的数字 / 年份 / 空壳节点
        flat_nodes = _sanitize_nodes(flat_nodes)
        retained_nodes = await _smart_collapse(article_name, flat_nodes, limit, state)
        retained_nodes = _sanitize_nodes(retained_nodes)

        # v14: 跳过独立 Plan 阶段；直接复用 Pre-Plan 产出的骨架
        # （Map 已按骨架对齐抽取，parent_topic 应已与骨架对齐）
        chunk_summaries = [
            {"chunk_id": mr.get("chunk_id", ""), "summary": mr.get("summary", "")}
            for mr in map_results
        ]
        skeleton_json = pre_plan_skeleton_json

        # ---- Reduce ----
        reduce_nodes = [
            {
                "topic": n.get("topic", ""),
                "parent_topic": n.get("parent_topic", "ROOT"),
                "summary": n.get("summary", ""),
                "source_chunk_id": n.get("source_chunk_id", ""),
            }
            for n in retained_nodes
        ]
        reduce_nodes_json = json.dumps(reduce_nodes, ensure_ascii=False)
        _save_debug(state, f"04_reduce_input_{article_name}.json", {
            "chunk_summaries": chunk_summaries,
            "headings": headings_md,
            "skeleton": skeleton_json,
            "retained_nodes": reduce_nodes,
        })

        # v15: 给 Reduce 提供原文摘录（首 25K + 尾 10K chars），让最终渲染有全局视野
        _red_head_chars = 25000
        _red_tail_chars = 10000
        _src = article["content"]
        if len(_src) > _red_head_chars + _red_tail_chars + 500:
            reduce_excerpt = _src[:_red_head_chars] + "\n\n[... 中间省略 ...]\n\n" + _src[-_red_tail_chars:]
        else:
            reduce_excerpt = _src

        prompt = _build_reduce_prompt(
            chunk_summaries=chunk_summaries,
            headings_md=headings_md,
            retained_nodes_json=reduce_nodes_json,
            language=language,
            max_depth=state.request.max_depth,
            skeleton_json=skeleton_json,
            source_excerpt=reduce_excerpt,
        )
        try:
            raw = await _call_llm(prompt, state, temperature=0.3)
            markdown = _clean_markdown_output(raw)
        except Exception as e:
            log.error(f"[Reduce {article_name}] 失败: {e}")
            markdown = f"# {article['filename']}\n## Error\n### {e}"

        return {
            "markdown": markdown,
            "chunk_summaries": chunk_summaries,
            "retained_nodes": retained_nodes,
            "headings": headings_md,
        }

    async def _run_article(article: Dict[str, Any], state: KBMindMapState) -> Dict[str, Any]:
        """单篇文章完整管线：routing → direct/mapreduce → per-article markdown。"""
        model = state.request.model or ""
        limit = _get_chunk_token_limit(model)
        tokens = _count_tokens(article["content"], model)
        if tokens < limit:
            md = await _run_article_direct(article, state)
            return {
                "filename": article["filename"],
                "route": "direct",
                "markdown": md,
                "token_count": tokens,
                "chunk_summaries": [],
                "retained_nodes": [],
                "headings": "",
            }
        result = await _run_article_mapreduce(article, state, limit)
        return {
            "filename": article["filename"],
            "route": "mapreduce",
            "token_count": tokens,
            **result,
        }

    # ==================== Graph 节点：Process / Merge / Beautify ====================

    async def process_articles_node(state: KBMindMapState) -> KBMindMapState:
        """对每篇文章并发跑内部管线（direct 或 mapreduce），产出 per-article markdown。"""
        if not state.file_contents:
            state.per_article_results = []
            state.mermaid_code = "# Error\n## No content available"
            return state

        model = state.request.model or ""
        limit = _get_chunk_token_limit(model)
        state.context_window_limit = limit
        # 给每篇文章加 _file_idx 便于 chunk_id 编号
        for i, item in enumerate(state.file_contents):
            item["_file_idx"] = f"file{i}"

        state.total_content_tokens = sum(
            _count_tokens(item["content"], model) for item in state.file_contents
        )

        article_meta = [
            {
                "filename": item["filename"],
                "token_count": _count_tokens(item["content"], model),
                "route": "direct" if _count_tokens(item["content"], model) < limit else "mapreduce",
            }
            for item in state.file_contents
        ]
        any_mapreduce = any(a["route"] == "mapreduce" for a in article_meta)
        # 兼容老 Pipeline Debug UI：保留 use_mapreduce / chunks_summary 等字段
        _save_debug(state, "01_routing.json", {
            "threshold_ratio": LONG_TEXT_THRESHOLD_RATIO,
            "chunk_token_limit": limit,
            "model": model,
            "total_tokens": state.total_content_tokens,
            "articles": article_meta,
            # --- legacy keys ---
            "use_mapreduce": any_mapreduce,
            "total_content_tokens": state.total_content_tokens,
            "context_window_limit": limit,
            "file_count": len(state.file_contents),
            "file_tokens": [a["token_count"] for a in article_meta],
            "file_names": [a["filename"] for a in article_meta],
            "chunk_count": 0,
            "chunks_summary": [],
        })

        log.info(
            f"[MindMap] Per-article 处理 {len(state.file_contents)} 篇，limit={limit}"
        )
        tasks = [_run_article(item, state) for item in state.file_contents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        per_article: List[Dict[str, Any]] = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                fn = state.file_contents[i]["filename"]
                log.error(f"[MindMap] 文章 {fn} 处理失败: {r}")
                per_article.append({
                    "filename": fn,
                    "route": "error",
                    "markdown": f"# {fn}\n## Error\n### {r}",
                    "token_count": 0,
                    "chunk_summaries": [],
                    "retained_nodes": [],
                    "headings": "",
                })
            else:
                per_article.append(r)

        state.per_article_results = per_article
        _save_debug(state, "05_per_article_markdown.json", [
            {"filename": p["filename"], "route": p["route"], "markdown": p["markdown"]}
            for p in per_article
        ])
        # 兼容老 Pipeline Debug UI：聚合一份 02_map_results.json（来自 mapreduce 路径的文章）
        aggregated_map: List[Dict[str, Any]] = []
        for p in per_article:
            if p.get("route") != "mapreduce":
                continue
            for cs in p.get("chunk_summaries", []):
                chunk_id = cs.get("chunk_id", "")
                nodes = [
                    n for n in (p.get("retained_nodes") or [])
                    if n.get("source_chunk_id") == chunk_id
                ]
                aggregated_map.append({"chunk_id": chunk_id, "nodes": nodes})
        if aggregated_map:
            _save_debug(state, "02_map_results.json", aggregated_map)
        return state

    async def merge_articles_node(state: KBMindMapState) -> KBMindMapState:
        """若 ≥2 篇文章，调 LLM 合并为单份 mindmap；若 1 篇直通。"""
        results = state.per_article_results or []
        if not results:
            state.mermaid_code = "# Error\n## No content"
            return state
        if len(results) == 1:
            state.mermaid_code = results[0].get("markdown") or "# Error\n## Empty"
            return state

        article_markdowns = [
            {"filename": p["filename"], "markdown": p.get("markdown", "")}
            for p in results
        ]
        _save_debug(state, "06_merge_input.json", article_markdowns)

        prompt = _build_merge_prompt(article_markdowns, state.request.language, state.request.max_depth)
        try:
            raw = await _call_llm(prompt, state, temperature=0.3)
            merged = _clean_markdown_output(raw)
        except Exception as e:
            log.error(f"[MindMap Merge] 失败: {e}")
            # fallback：拼接各篇，降级为 heading
            merged = "# 综合思维导图\n\n" + "\n\n".join(
                "## " + p["filename"] + "\n" + (p.get("markdown") or "").replace("# ", "### ", 1)
                for p in results
            )
        state.mermaid_code = merged
        _save_debug(state, "07_merged_markdown.md", merged)
        return state

    async def beautify_node(state: KBMindMapState) -> KBMindMapState:
        """可选美化：结构重平衡 + 命名优化，一次 LLM 调用。失败保留原导图。"""
        if not state.request.beautify:
            return state
        current = state.mermaid_code or ""
        if not current.strip():
            return state
        _save_debug(state, "08_beautify_input.md", current)
        prompt = _build_beautify_prompt(current, state.request.language, state.request.max_depth)
        try:
            raw = await _call_llm(prompt, state, temperature=0.3)
            polished = _clean_markdown_output(raw)
            if polished.strip():
                state.mermaid_code = polished
                _save_debug(state, "09_beautify_output.md", polished)
                log.info("[MindMap Beautify] 完成")
        except Exception as e:
            log.error(f"[MindMap Beautify] 失败，保留未美化版本: {e}")
        return state

    async def save_and_end_node(state: KBMindMapState) -> KBMindMapState:
        """Markdown 标题树 → mindmap.md + mindmap.mmd；mermaid_code 最终为 mermaid 版本。"""
        try:
            markdown_content = state.mermaid_code or ""
            mermaid_content = markdown_to_mermaid(markdown_content)

            result_dir = Path(state.result_path)
            result_dir.mkdir(parents=True, exist_ok=True)

            (result_dir / "mindmap.md").write_text(markdown_content, encoding="utf-8")
            (result_dir / "mindmap.mmd").write_text(mermaid_content, encoding="utf-8")

            state.mermaid_code = mermaid_content
            log.info(f"[MindMap] 已保存 mindmap.md + mindmap.mmd -> {result_dir}")
        except Exception as e:
            log.error(f"[MindMap] 保存失败: {e}")
        return state

    # ==================== 构建图 ====================

    nodes = {
        "_start_": _start_,
        "parse_files": parse_files_node,
        "process_articles": process_articles_node,
        "merge_articles": merge_articles_node,
        "beautify": beautify_node,
        "save_and_end": save_and_end_node,
        "_end_": lambda s: s,
    }

    edges = [
        ("_start_", "parse_files"),
        ("parse_files", "process_articles"),
        ("process_articles", "merge_articles"),
        ("merge_articles", "beautify"),
        ("beautify", "save_and_end"),
        ("save_and_end", "_end_"),
    ]

    builder.add_nodes(nodes).add_edges(edges)
    return builder
