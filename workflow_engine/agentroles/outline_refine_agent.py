"""
Outline refine agent for KB PPT pipeline.
"""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from workflow_engine.state import MainState
from workflow_engine.toolkits.tool_manager import ToolManager
from workflow_engine.logger import get_logger
from workflow_engine.agentroles.cores.base_agent import BaseAgent
from workflow_engine.agentroles.cores.registry import register

log = get_logger(__name__)


@register("outline_refine_agent")
class OutlineRefineAgent(BaseAgent):
    @classmethod
    def create(cls, tool_manager: Optional[ToolManager] = None, **kwargs):
        return cls(tool_manager=tool_manager, **kwargs)

    @property
    def role_name(self) -> str:
        return "outline_refine_agent"

    @property
    def system_prompt_template_name(self) -> str:
        return "system_prompt_for_outline_refine_agent"

    @property
    def task_prompt_template_name(self) -> str:
        return "task_prompt_for_outline_refine_agent"

    def get_task_prompt_params(self, pre_tool_results: Dict[str, Any]) -> Dict[str, Any]:
        pagecontent_raw = pre_tool_results.get("pagecontent_raw", []) or []
        page_count = len(pagecontent_raw) or len(getattr(self.state, "pagecontent", []) or []) or self.state.request.page_count
        return {
            "outline_feedback": pre_tool_results.get("outline_feedback", ""),
            "minueru_output": pre_tool_results.get("minueru_output", ""),
            "text_content": pre_tool_results.get("text_content", ""),
            "pagecontent": pre_tool_results.get("pagecontent", "[]"),
            "page_count": page_count,
            "language": self.state.request.language,
            "pagecontent_raw": json.dumps(pagecontent_raw, ensure_ascii=False),
        }

    def update_state_result(
        self,
        state: MainState,
        result: Dict[str, Any],
        pre_tool_results: Dict[str, Any],
    ):
        state.pagecontent = result
        log.info("[outline_refine_agent]: refined %s pages", len(result or []))
        super().update_state_result(state, result, pre_tool_results)
