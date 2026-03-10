"""
Knowledge Base Intelligent Q&A Workflow - 重构版
使用引入层处理后的数据，支持文档和媒体文件
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from typing import List, Dict, Any

from dataflow_agent.workflow.registry import register
from dataflow_agent.graphbuilder.graph_builder import GenericGraphBuilder
from dataflow_agent.logger import get_logger
from dataflow_agent.state import IntelligentQAState, MainState
from dataflow_agent.agentroles import create_vlm_agent, create_agent
from dataflow_agent.features.shared import ProcessedDataLoader, extract_text_result
from dataflow_agent.promptstemplates.resources.pt_qa_agent_repo import QaAgent as QaAgentPrompts

log = get_logger(__name__)

MAX_DOC_CONTEXT_CHARS = 48000
RAG_TOP_K = 30
MAX_HISTORY_TURNS = 10


@register("intelligent_qa")
def create_intelligent_qa_graph() -> GenericGraphBuilder:
    """智能问答工作流"""
    builder = GenericGraphBuilder(state_model=IntelligentQAState, entry_point="_start_")

    def _start_(state: IntelligentQAState) -> IntelligentQAState:
        if not state.request.file_ids:
            state.request.file_ids = []
        if not state.request.query:
            state.request.query = ""
        state.file_analyses = []
        return state

    async def parallel_parse_node(state: IntelligentQAState) -> IntelligentQAState:
        """并行加载和分析文件"""
        file_ids = state.request.file_ids
        if not file_ids:
            state.file_analyses = []
            return state

        vector_store_base_dir = state.request.vector_store_base_dir
        if not vector_store_base_dir:
            log.error("vector_store_base_dir not provided")
            state.file_analyses = []
            return state

        manifest_path = Path(vector_store_base_dir) / "knowledge_manifest.json"
        if not manifest_path.exists():
            log.error(f"Manifest not found: {manifest_path}")
            state.file_analyses = []
            return state

        loader = ProcessedDataLoader(str(manifest_path))

        async def process_file(file_id: str) -> Dict[str, Any]:
            record = loader.get_file_record(file_id)
            if not record:
                return {"filename": file_id, "analysis": f"[Error: File record not found]", "content": ""}

            filename = Path(record.get("original_path", "unknown")).name
            original_path = record.get("original_path", "")
            suffix = Path(original_path).suffix.lower() if original_path else ""

            # 判断文件类型
            is_media = suffix in [".jpg", ".jpeg", ".png", ".mp4", ".mov", ".avi"]

            try:
                if is_media:
                    # 媒体文件：使用VLM分析
                    vlm_mode = "understanding"
                    input_key = "input_image"
                    if suffix in [".mp4", ".mov", ".avi"]:
                        vlm_mode = "video_understanding"
                        input_key = "input_video"

                    vlm_prompt = QaAgentPrompts.file_analysis_prompt.format(
                        filename=filename,
                        file_type="media",
                        content="[Media content attached]",
                        query=state.request.query
                    )

                    agent = create_vlm_agent(
                        name="kb_vlm_prompt_agent",
                        vlm_mode=vlm_mode,
                        model_name="gemini-2.5-flash",
                        chat_api_url=state.request.chat_api_url,
                        parser_type="text",
                        additional_params={input_key: original_path}
                    )

                    temp_state = MainState(request=state.request)
                    temp_state.temp_data["kb_vlm_prompt"] = vlm_prompt
                    res_state = await agent.execute(temp_state)
                    analysis_result = extract_text_result(res_state, "kb_vlm_prompt_agent")

                    return {
                        "filename": filename,
                        "analysis": analysis_result or "[VLM returned no content]",
                        "content": "[Media file]"
                    }
                else:
                    # 文档文件：使用MinerU处理后的markdown
                    markdown = loader.get_mineru_markdown(file_id)
                    if not markdown:
                        return {"filename": filename, "analysis": "[Markdown not found]", "content": ""}

                    truncated_content = markdown[:50000] if len(markdown) > 50000 else markdown

                    analysis_prompt = QaAgentPrompts.file_analysis_prompt.format(
                        filename=filename,
                        file_type="document",
                        content=truncated_content,
                        query=state.request.query
                    )

                    agent = create_agent(
                        name="kb_prompt_agent",
                        model_name=state.request.model,
                        chat_api_url=state.request.chat_api_url,
                        temperature=0.3,
                        parser_type="text"
                    )

                    temp_state = MainState(request=state.request)
                    res_state = await agent.execute(temp_state, prompt=analysis_prompt)
                    analysis_result = extract_text_result(res_state, "kb_prompt_agent")

                    return {
                        "filename": filename,
                        "analysis": analysis_result or "[LLM Analysis Failed]",
                        "content": truncated_content[:1000] + "..." if len(truncated_content) > 1000 else truncated_content
                    }

            except Exception as e:
                log.exception(f"Analysis failed for {filename}")
                return {"filename": filename, "analysis": f"[Analysis Error: {e}]", "content": ""}

        tasks = [process_file(fid) for fid in file_ids]
        results = await asyncio.gather(*tasks)
        state.file_analyses = results
        return state

    def _try_rag_retrieve(state: IntelligentQAState) -> None:
        """RAG检索：从向量库检索相关片段"""
        base_dir = getattr(state.request, "vector_store_base_dir", None) or ""
        if not base_dir or not state.request.file_ids or not state.request.query:
            return

        base_path = Path(base_dir)
        if not base_path.exists():
            return

        try:
            from dataflow_agent.toolkits.ragtool.vector_store_tool import VectorStoreManager
            manager = VectorStoreManager(base_dir=base_dir)
            if manager.index is None or manager.index.ntotal == 0:
                return

            results = manager.search(
                query=state.request.query,
                top_k=RAG_TOP_K,
                file_ids=state.request.file_ids,
            )
            state.retrieved_chunks = results
            log.info(f"RAG 检索到 {len(results)} 个片段")
        except Exception as e:
            log.warning(f"RAG 检索跳过: {e}")
            state.retrieved_chunks = []

    def _format_history(history: List[Dict[str, str]]) -> str:
        """格式化对话历史"""
        if not history:
            return ""
        recent = history[-MAX_HISTORY_TURNS * 2:]
        lines = []
        for msg in recent:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                lines.append(f"User: {content}")
            else:
                lines.append(f"Assistant: {content}")
        return "\n".join(lines)

    def _build_doc_context(state: IntelligentQAState) -> str:
        """构建文档上下文：RAG片段 + 文件分析"""
        parts: List[str] = []
        total = 0

        # 建立来源映射
        source_mapping: Dict[int, str] = {}
        if state.request.file_ids:
            vector_store_base_dir = state.request.vector_store_base_dir
            if vector_store_base_dir:
                manifest_path = Path(vector_store_base_dir) / "knowledge_manifest.json"
                if manifest_path.exists():
                    loader = ProcessedDataLoader(str(manifest_path))
                    for idx, file_id in enumerate(state.request.file_ids, 1):
                        record = loader.get_file_record(file_id)
                        if record:
                            filename = Path(record.get("original_path", "unknown")).name
                            source_mapping[idx] = filename
        state.source_mapping = source_mapping

        # RAG片段
        if state.retrieved_chunks:
            manifest_files: Dict[str, str] = {}
            try:
                from dataflow_agent.toolkits.ragtool.vector_store_tool import VectorStoreManager
                base_dir = getattr(state.request, "vector_store_base_dir", None) or ""
                if base_dir:
                    mgr = VectorStoreManager(base_dir=base_dir)
                    for f in (mgr.manifest.get("files") or []):
                        if f.get("id"):
                            manifest_files[f["id"]] = Path(f.get("original_path", "")).name or f["id"]
            except Exception:
                pass

            for item in state.retrieved_chunks:
                content = (item.get("content") or "").strip()
                if not content:
                    continue
                fid = item.get("source_file_id", "")
                name = manifest_files.get(fid, fid)
                block = f"--- [{name}] ---\n{content}\n\n"
                if total + len(block) > MAX_DOC_CONTEXT_CHARS:
                    break
                parts.append(block)
                total += len(block)

        # 文件分析
        if state.file_analyses:
            for item in state.file_analyses:
                fname = item.get('filename', '')
                block = f"--- Analysis of {fname} ---\n{item.get('analysis', '')}\n\n"
                if total + len(block) > MAX_DOC_CONTEXT_CHARS:
                    break
                parts.append(block)
                total += len(block)

        # 来源映射
        if source_mapping:
            mapping_lines = ["Sources:"]
            for idx in sorted(source_mapping.keys()):
                mapping_lines.append(f"[{idx}] {source_mapping[idx]}")
            parts.append("\n".join(mapping_lines) + "\n")

        return "".join(parts)

    async def chat_node(state: IntelligentQAState) -> IntelligentQAState:
        """最终问答：RAG检索 + 文档上下文 + 对话历史"""
        _try_rag_retrieve(state)
        doc_context = _build_doc_context(state)
        history_str = _format_history(state.request.history)

        final_prompt = QaAgentPrompts.final_qa_prompt.format(
            query=state.request.query,
            file_analyses=doc_context,
            history=history_str,
        )

        agent = create_agent(
            name="kb_prompt_agent",
            model_name=state.request.model,
            chat_api_url=state.request.chat_api_url,
            temperature=0.7,
            parser_type="text",
        )

        new_state = await agent.execute(state, prompt=final_prompt)
        answer_text = extract_text_result(new_state, "kb_prompt_agent")
        state.answer = answer_text or "Sorry, I couldn't generate an answer."

        return state

    # Build graph
    builder.add_node("_start_", _start_)
    builder.add_node("parallel_parse", parallel_parse_node)
    builder.add_node("chat", chat_node)

    builder.add_edge("_start_", "parallel_parse")
    builder.add_edge("parallel_parse", "chat")
    builder.set_finish_point("chat")

    return builder

