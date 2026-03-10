"""
Shared utility functions for workflows
"""
from typing import Any, Dict
from workflow_engine.state import MainState


def extract_text_result(state: MainState, role_name: str) -> str:
    """从agent结果中提取文本内容"""
    try:
        result = state.agent_results.get(role_name, {}).get("results", {})
        if isinstance(result, dict):
            return result.get("text") or result.get("raw") or ""
        if isinstance(result, str):
            return result
    except Exception:
        return ""
    return ""
