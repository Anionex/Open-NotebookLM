"""
KB Prompt Agents
Generic prompt-based agents for knowledge base workflows.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from workflow_engine.state import MainState
from workflow_engine.toolkits.tool_manager import ToolManager
from workflow_engine.logger import get_logger
from workflow_engine.agentroles.cores.base_agent import BaseAgent
from workflow_engine.agentroles.cores.registry import register

log = get_logger(__name__)


@register("kb_prompt_agent")
class KbPromptAgent(BaseAgent):
    """Run a custom prompt in text mode."""

    @classmethod
    def create(cls, tool_manager: Optional[ToolManager] = None, **kwargs):
        return cls(tool_manager=tool_manager, **kwargs)

    @property
    def role_name(self) -> str:
        return "kb_prompt_agent"

    @property
    def system_prompt_template_name(self) -> str:
        return "system_prompt_for_kb_prompt_agent"

    @property
    def task_prompt_template_name(self) -> str:
        return "task_prompt_for_kb_prompt_agent"

    def get_task_prompt_params(self, pre_tool_results: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "prompt": pre_tool_results.get("prompt", ""),
        }


@register("kb_vlm_prompt_agent")
class KbVlmPromptAgent(BaseAgent):
    """Run a custom prompt in VLM mode (image/video)."""

    @classmethod
    def create(cls, tool_manager: Optional[ToolManager] = None, **kwargs):
        return cls(tool_manager=tool_manager, **kwargs)

    @property
    def role_name(self) -> str:
        return "kb_vlm_prompt_agent"

    @property
    def system_prompt_template_name(self) -> str:
        return "system_prompt_for_kb_prompt_agent"

    @property
    def task_prompt_template_name(self) -> str:
        return "task_prompt_for_kb_prompt_agent"

    def get_task_prompt_params(self, pre_tool_results: Dict[str, Any]) -> Dict[str, Any]:
        # VLM path does not merge kwargs into pre_tool_results.
        # Use temp_data for prompt injection when available.
        prompt = ""
        try:
            prompt = self.state.temp_data.get("kb_vlm_prompt", "")
        except Exception:
            prompt = ""
        if not prompt:
            prompt = pre_tool_results.get("prompt", "")
        return {"prompt": prompt}

