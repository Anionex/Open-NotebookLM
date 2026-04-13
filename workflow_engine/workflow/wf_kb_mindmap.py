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
        """
        Analyze content structure using LLM
        """
        if not state.file_contents:
            state.content_structure = "No content available for analysis."
            return state

        # Format file contents
        contents_str = ""
        for item in state.file_contents:
            contents_str += f"=== {item['filename']} ===\n{item['content']}\n\n"

        # Structure analysis prompt
        language = state.request.language
        max_depth = state.request.max_depth
        prompt = f"""你是一位专业的知识结构分析师。请分析以下文档内容，提取出一份“跨来源综合”的层级化知识结构。

要求：
1. 先综合多个来源的共同主题、关键问题、方法、证据和结论，不要按“论文A/论文B/来源1/来源2”逐篇罗列
2. 一级节点必须是概念主题、方法模块、问题域、结论方向这类“内容主题”，不能是“训练目标革新”“前沿方向”“跨方向关联”这类空泛包装词
3. 每个节点要尽量信息密实，优先保留能支撑导图理解的关键词、方法名、现象名、关键结论和关键证据
4. 建立清晰的层级关系（最多{max_depth}层）
5. 使用{language}语言
6. 输出格式为层级化的文本结构，使用缩进表示层级
7. 如果多个来源之间存在对应关系，应把它们放到同一主题分支下整合，而不是拆成平行的来源分支

文档内容：
{contents_str}

请输出层级化的知识结构："""

        try:
            agent = create_agent(
                name="kb_prompt_agent",
                model_name=state.request.model,
                chat_api_url=state.request.chat_api_url,
                temperature=0.3,
                parser_type="text"
            )

            temp_state = MainState(request=state.request)
            res_state = await agent.execute(temp_state, prompt=prompt)

            state.content_structure = _extract_text_result(res_state, "kb_prompt_agent") or "[Structure analysis failed]"
        except Exception as e:
            log.error(f"Structure analysis failed: {e}")
            state.content_structure = f"[Structure analysis error: {e}]"

        return state

    async def generate_mermaid_node(state: KBMindMapState) -> KBMindMapState:
        """
        Generate Mermaid mindmap syntax using LLM
        """
        if not state.content_structure or state.content_structure.startswith("["):
            state.mermaid_code = "mindmap\n  root((Error))\n    No content structure available"
            return state

        # Mermaid generation prompt
        style = state.request.mindmap_style
        prompt = f"""你是一位专业的 Mermaid 导图专家。请根据以下知识结构，生成高质量的 Mermaid mindmap 语法。

知识结构：
{state.content_structure}

要求：
1. 使用 Mermaid mindmap 语法
2. 风格：{style}
3. 保持层级关系清晰，根节点必须是本批资料的“综合主题”，不能是“大型语言模型前沿方向”“研究方向综述”这类空泛标题
4. 不要按论文名、来源名、文件名建一级分支；一级分支必须是概念主题、问题域、方法模块、关键发现、应用价值等内容主题
5. 节点名称要具体，优先使用方法名、现象名、任务名、结论名、关键术语；避免“核心问题/解决方案/关键发现/风险场景/缓解措施/未来探索”这类空壳节点反复出现
6. 每个分支尽量表达“是什么 -> 为什么重要 -> 关键证据/机制”的信息密度，避免只有目录感没有内容
7. 如果多个来源讨论的是同一主题，合并到同一分支中，不要拆成并列来源分组
8. 只输出 Mermaid 代码，不要输出解释，不要加 markdown 代码块
9. 输出必须以 `mindmap` 开头

Mermaid mindmap语法示例：
mindmap
  root((中心主题))
    主题1
      子主题1.1
      子主题1.2
    主题2
      子主题2.1

请生成Mermaid mindmap代码："""

        try:
            agent = create_agent(
                name="kb_prompt_agent",
                model_name=state.request.model,
                chat_api_url=state.request.chat_api_url,
                temperature=0.5,
                parser_type="text"
            )

            temp_state = MainState(request=state.request)
            res_state = await agent.execute(temp_state, prompt=prompt)

            mermaid_raw = _extract_text_result(res_state, "kb_prompt_agent")
            if mermaid_raw:
                # Extract mermaid code from markdown code blocks if present
                if "```" in mermaid_raw:
                    lines = mermaid_raw.split("\n")
                    in_code_block = False
                    code_lines = []
                    for line in lines:
                        if line.strip().startswith("```"):
                            in_code_block = not in_code_block
                            continue
                        if in_code_block:
                            code_lines.append(line)
                    state.mermaid_code = "\n".join(code_lines)
                else:
                    state.mermaid_code = mermaid_raw
            else:
                state.mermaid_code = "mindmap\n  root((Error))\n    Generation failed"
        except Exception as e:
            log.error(f"Mermaid generation failed: {e}")
            state.mermaid_code = f"mindmap\n  root((Error))\n    {str(e)}"

        # Save mermaid code to file
        try:
            mermaid_path = Path(state.result_path) / "mindmap.mmd"
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
