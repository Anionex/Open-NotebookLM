"""
Knowledge Base MindMap Workflow - 重构版
使用引入层处理后的数据，不直接解析文件
"""
from __future__ import annotations
import os
import re
from pathlib import Path
from typing import Dict, Any

from workflow_engine.workflow.registry import register
from workflow_engine.graphbuilder.graph_builder import GenericGraphBuilder
from workflow_engine.logger import get_logger
from workflow_engine.state import KBMindMapState
from workflow_engine.agentroles import create_agent
from workflow_engine.features.shared import ProcessedDataLoader, extract_text_result

log = get_logger(__name__)


@register("kb_mindmap")
def create_kb_mindmap_graph() -> GenericGraphBuilder:
    """知识库思维导图生成工作流"""
    builder = GenericGraphBuilder(state_model=KBMindMapState, entry_point="_start_")

    def _start_(state: KBMindMapState) -> KBMindMapState:
        if not state.request.file_ids:
            state.request.file_ids = []

        # Initialize output directory
        if not state.result_path:
            from workflow_engine.utils import get_project_root
            import time
            ts = int(time.time())
            email = getattr(state.request, 'email', 'default')
            safe_email = re.sub(r'[^\w\-.]', '_', (email or 'default').replace('@', '_at_'))
            output_dir = get_project_root() / "outputs" / "kb_outputs" / safe_email / f"{ts}_mindmap"
            output_dir.mkdir(parents=True, exist_ok=True)
            state.result_path = str(output_dir)

        state.file_contents = []
        state.content_structure = ""
        state.mermaid_code = ""
        state.mindmap_svg_path = ""
        return state

    def load_processed_files_node(state: KBMindMapState) -> KBMindMapState:
        """从引入层加载已处理的文件"""
        file_ids = state.request.file_ids
        if not file_ids:
            state.file_contents = []
            return state

        vector_store_base_dir = state.request.vector_store_base_dir
        if not vector_store_base_dir:
            log.error("vector_store_base_dir not provided")
            state.file_contents = []
            return state

        manifest_path = Path(vector_store_base_dir) / "knowledge_manifest.json"
        if not manifest_path.exists():
            log.error(f"Manifest not found: {manifest_path}")
            state.file_contents = []
            return state

        loader = ProcessedDataLoader(str(manifest_path))
        file_contents = []

        for file_id in file_ids:
            record = loader.get_file_record(file_id)
            if not record:
                log.warning(f"File record not found: {file_id}")
                continue

            markdown = loader.get_mineru_markdown(file_id)
            if not markdown:
                log.warning(f"Markdown not found for file: {file_id}")
                continue

            filename = Path(record.get("original_path", "unknown")).name
            truncated_content = markdown[:50000] if len(markdown) > 50000 else markdown

            file_contents.append({
                "filename": filename,
                "content": truncated_content
            })

        state.file_contents = file_contents
        return state

    async def analyze_structure_node(state: KBMindMapState) -> KBMindMapState:
        """分析内容结构"""
        if not state.file_contents:
            state.content_structure = "No content available for analysis."
            return state

        contents_str = ""
        for item in state.file_contents:
            contents_str += f"=== {item['filename']} ===\n{item['content']}\n\n"

        language = state.request.language
        max_depth = state.request.max_depth
        prompt = f"""你是一位专业的知识结构分析师。请分析以下文档内容，提取出层级化的知识结构。

要求：
1. 识别主要主题和子主题
2. 提取关键概念和要点
3. 建立清晰的层级关系（最多{max_depth}层）
4. 使用{language}语言
5. 输出格式为层级化的文本结构，使用缩进表示层级

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

            result = await agent.ainvoke(state, prompt=prompt)
            state.content_structure = extract_text_result(state, agent.role_name)
        except Exception as e:
            log.exception("Structure analysis failed")
            state.content_structure = f"[Error: {e}]"

        return state

    async def generate_mermaid_node(state: KBMindMapState) -> KBMindMapState:
        """生成Mermaid思维导图代码"""
        if not state.content_structure:
            state.mermaid_code = "mindmap\n  root((No Content))"
            return state

        language = state.request.language
        prompt = f"""你是一位Mermaid思维导图专家。请将以下层级化的知识结构转换为Mermaid mindmap语法。

要求：
1. 使用Mermaid mindmap语法
2. 保持层级关系清晰
3. 使用{language}语言
4. 确保语法正确，可以直接渲染

知识结构：
{state.content_structure}

请输出Mermaid代码（只输出代码，不要其他说明）："""

        try:
            agent = create_agent(
                name="kb_prompt_agent",
                model_name=state.request.model,
                chat_api_url=state.request.chat_api_url,
                temperature=0.2,
                parser_type="text"
            )

            result = await agent.ainvoke(state, prompt=prompt)
            mermaid_code = extract_text_result(state, agent.role_name)

            # Clean up code blocks
            mermaid_code = mermaid_code.replace("```mermaid", "").replace("```", "").strip()
            state.mermaid_code = mermaid_code

            # Save to file
            output_path = Path(state.result_path) / "mindmap.mmd"
            output_path.write_text(mermaid_code, encoding='utf-8')

        except Exception as e:
            log.exception("Mermaid generation failed")
            state.mermaid_code = f"mindmap\n  root((Error: {e}))"

        return state

    # Build graph
    builder.add_node("_start_", _start_)
    builder.add_node("load_processed_files", load_processed_files_node)
    builder.add_node("analyze_structure", analyze_structure_node)
    builder.add_node("generate_mermaid", generate_mermaid_node)

    builder.add_edge("_start_", "load_processed_files")
    builder.add_edge("load_processed_files", "analyze_structure")
    builder.add_edge("analyze_structure", "generate_mermaid")
    builder.set_finish_point("generate_mermaid")

    return builder
