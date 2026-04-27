from __future__ import annotations
import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any

import fitz  # PyMuPDF
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

@register("kb_mindmap")
def create_kb_mindmap_graph() -> GenericGraphBuilder:
    """
    Workflow for Knowledge Base MindMap Generation
    Steps:
    1. Parse uploaded files (PDF/Office)
    2. Analyze content structure using LLM
    3. Generate Mermaid mindmap syntax using LLM
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

    def _strip_markdown_code_fence(text: str) -> str:
        cleaned = str(text or "").strip()
        if "```" not in cleaned:
            return cleaned
        lines = cleaned.splitlines()
        in_code_block = False
        code_lines: List[str] = []
        for line in lines:
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                code_lines.append(line)
        return "\n".join(code_lines).strip() or cleaned

    def _normalize_markdown_headings(text: str, max_depth: int) -> str:
        lines: List[str] = []
        for raw_line in _strip_markdown_code_fence(text).splitlines():
            line = raw_line.rstrip()
            stripped = line.lstrip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                hashes = len(stripped) - len(stripped.lstrip("#"))
                title = stripped[hashes:].strip()
                if title:
                    level = max(1, min(hashes, max_depth))
                    lines.append(f"{'#' * level} {title}")
            elif lines:
                lines.append(f"{'#' * min(max_depth, 3)} {stripped.strip('-* ')}")
        return "\n".join(lines).strip()

    async def _run_docmerge_markdown_prompt(
        state: KBMindMapState,
        prompt: str,
        *,
        temperature: float,
    ) -> str:
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

    def _single_doc_prompt(filename: str, content: str, max_depth: int, language: str) -> str:
        return f"""请根据以下单篇文档内容生成一个思维导图。
要求：
- 当前只处理这一篇文档，不要混入其他文档信息
- 最大层级深度为 {max_depth} 层
- 使用 {language} 语言
- 提取关键概念、论点和结构化要点
- 保留关键数据、时间、比例、数量、金额、指标或实验结果
- 节点命名尽量简练
- 直接输出 Markdown 标题层级，使用 #、##、### 表示层级
- 不要使用代码块，不要输出解释

=== 文档: {filename} ===
{content}
"""

    def _merge_prompt(document_trees: List[Dict[str, str]], max_depth: int, language: str) -> str:
        tree_sections = "\n\n".join(
            f"=== 文档思维导图: {item['filename']} ===\n{item['markdown']}"
            for item in document_trees
        )
        return f"""请根据下面多篇文档各自生成的思维导图，生成一个最终思维导图。
要求：
- 最大层级深度为 {max_depth} 层
- 使用 {language} 语言
- 先判断文档之间的主题相关性和内容重叠度，再决定组织方式
- 如果多篇文档讨论同一主题、同一任务链路或高度重叠的方法体系，可以按主题融合，并合并相近概念
- 如果文档主题明显不同、只是同属宽泛领域，优先保留清晰的并列主分支，不要为了融合而强行抽象出共同上位概念
- 对弱相关文档，主分支可以使用各自的核心主题，而不是文档文件名；在各主题下保留该文档的关键结构
- 文档独有内容应保留在对应主题下，避免被过度概括或丢失
- 保留关键数据、时间、比例、数量、金额、指标或实验结果
- 直接输出 Markdown 标题层级，使用 #、##、### 表示层级
- 不要使用代码块，不要输出解释

{tree_sections}
"""

    def _start_(state: KBMindMapState) -> KBMindMapState:
        # Ensure request fields
        if not state.request.file_ids:
            state.request.file_ids = []

        # Initialize output directory
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
        return state

    async def parse_files_node(state: KBMindMapState) -> KBMindMapState:
        """
        Parse all files and extract content
        """
        files = state.request.file_ids
        if not files:
            state.file_contents = []
            return state

        async def process_file(file_path: str) -> Dict[str, Any]:
            file_path_obj = Path(file_path)
            filename = file_path_obj.name

            if not file_path_obj.exists():
                return {
                    "filename": filename,
                    "content": f"[Error: File not found {file_path}]"
                }

            suffix = file_path_obj.suffix.lower()
            raw_content = ""

            try:
                # PDF
                if suffix == ".pdf":
                    try:
                        doc = fitz.open(file_path)
                        text = ""
                        for page in doc:
                            text += page.get_text() + "\n"
                        raw_content = text
                    except Exception as e:
                        raw_content = f"[Error parsing PDF: {e}]"

                # Word
                elif suffix in [".docx", ".doc"]:
                    if Document is None:
                         raw_content = "[Error: python-docx not installed]"
                    else:
                        try:
                            doc = Document(file_path)
                            raw_content = "\n".join([p.text for p in doc.paragraphs])
                        except Exception as e:
                             raw_content = f"[Error parsing Docx: {e}]"

                # PPT
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
                    except:
                        raw_content = "[Unsupported file type]"

            except Exception as e:
                 raw_content = f"[Parse Error: {e}]"

            # Truncate content
            truncated_content = raw_content[:50000] if len(raw_content) > 50000 else raw_content

            return {
                "filename": filename,
                "content": truncated_content
            }

        # Run in parallel
        tasks = [process_file(f) for f in files]
        results = await asyncio.gather(*tasks)

        state.file_contents = results
        return state

    async def analyze_structure_node(state: KBMindMapState) -> KBMindMapState:
        """Skip structure analysis: single-pass generation happens downstream."""
        state.content_structure = "merged"
        return state

    async def generate_mermaid_node(state: KBMindMapState) -> KBMindMapState:
        """Generate a mindmap with the docmerge strategy: per-document trees, then merge."""
        if not state.file_contents:
            state.mermaid_code = "# Error\n## No content available"
            return state

        language = state.request.language
        max_depth = state.request.max_depth

        try:
            per_doc_maps: List[Dict[str, str]] = []
            for item in state.file_contents:
                filename = str(item.get("filename") or "未命名文档")
                content = str(item.get("content") or "").strip()
                if not content:
                    continue
                markdown = await _run_docmerge_markdown_prompt(
                    state,
                    _single_doc_prompt(filename, content, max_depth, language),
                    temperature=0.3,
                )
                normalized = _normalize_markdown_headings(markdown, max_depth=max_depth)
                if not normalized:
                    continue
                per_doc_maps.append({
                    "filename": filename,
                    "markdown": normalized,
                })

            if not per_doc_maps:
                state.mermaid_code = "# Error\n## No content available"
            elif len(per_doc_maps) == 1:
                state.mermaid_code = per_doc_maps[0]["markdown"]
            else:
                merged_markdown = await _run_docmerge_markdown_prompt(
                    state,
                    _merge_prompt(per_doc_maps, max_depth, language),
                    temperature=0.3,
                )
                state.mermaid_code = _normalize_markdown_headings(merged_markdown, max_depth=max_depth)
                if not state.mermaid_code:
                    state.mermaid_code = "# Error\n## Generation failed"
            if per_doc_maps:
                state.content_structure = "\n\n".join(
                    f"=== 文档思维导图: {item['filename']} ===\n{item['markdown']}"
                    for item in per_doc_maps
                )
        except Exception as e:
            log.error(f"DocMerge mindmap generation failed: {e}")
            state.mermaid_code = f"# Error\n## {str(e)}"

        # Save mermaid code to file
        try:
            mermaid_path = Path(state.result_path) / "mindmap.mmd"
            mermaid_path.parent.mkdir(parents=True, exist_ok=True)
            mermaid_path.write_text(state.mermaid_code, encoding="utf-8")
            log.info(f"Mermaid code saved to: {mermaid_path}")
        except Exception as e:
            log.error(f"Failed to save mermaid code: {e}")

        return state

    nodes = {
        "_start_": _start_,
        "parse_files": parse_files_node,
        "analyze_structure": analyze_structure_node,
        "generate_mermaid": generate_mermaid_node,
        "_end_": lambda s: s
    }

    edges = [
        ("_start_", "parse_files"),
        ("parse_files", "analyze_structure"),
        ("analyze_structure", "generate_mermaid"),
        ("generate_mermaid", "_end_")
    ]

    builder.add_nodes(nodes).add_edges(edges)
    return builder
