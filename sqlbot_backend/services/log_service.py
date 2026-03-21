"""
Agent日志服务 - 参考SQLBot的日志管理

SQLBot日志服务参考 (backend/apps/chat/curd/chat.py):
1. start_log: 开始一个LLM调用日志
2. end_log: 结束一个LLM调用日志
3. get_logs: 获取会话的所有日志
4. get_token_stats: 获取Token使用统计

使用方式:
    from sqlbot_backend.services.log_service import AgentLogService
    
    # 在Agent节点中使用
    log = AgentLogService.start_log(
        chat_id=123,
        operation="generate_sql",
        input_messages=messages
    )
    
    # LLM调用...
    
    AgentLogService.end_log(
        log=log,
        output_message=response.content,
        token_usage={"prompt_tokens": 100, "completion_tokens": 50},
        success=True
    )
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
import json

from sqlbot_backend.models.agent_log import AgentLog, OperationTypeEnum, estimate_cost

logger = logging.getLogger(__name__)

# 内存日志存储（简化版本，生产环境应使用数据库）
_log_store: Dict[int, List[AgentLog]] = {}
_log_id_counter = 0


class AgentLogService:
    """
    Agent日志服务
    
    提供Agent执行过程的完整日志记录功能
    """
    
    @staticmethod
    def start_log(
        chat_id: int,
        operation: str,
        input_messages: List[Dict[str, Any]] = None,
        step_index: int = 0,
        extra_data: Dict[str, Any] = None
    ) -> AgentLog:
        """
        开始一个操作日志
        
        Args:
            chat_id: 会话ID
            operation: 操作类型
            input_messages: 输入消息列表
            step_index: 步骤序号
            extra_data: 额外元数据
            
        Returns:
            AgentLog实例
        """
        global _log_id_counter
        _log_id_counter += 1
        
        log = AgentLog(
            id=_log_id_counter,
            chat_id=chat_id,
            operation=operation,
            step_index=step_index,
            input_messages=input_messages,
            created_at=datetime.now(),
            extra_data=extra_data
        )
        
        # 存储到内存
        if chat_id not in _log_store:
            _log_store[chat_id] = []
        _log_store[chat_id].append(log)
        
        logger.debug(f"Started log: chat_id={chat_id}, operation={operation}, log_id={log.id}")
        
        return log
    
    @staticmethod
    def end_log(
        log: AgentLog,
        output_message: str = None,
        thinking_content: str = None,
        tool_calls: List[Dict[str, Any]] = None,
        tool_results: List[Dict[str, Any]] = None,
        token_usage: Dict[str, int] = None,
        model_name: str = None,
        success: bool = True,
        error_message: str = None,
        sql_query: str = None,
        sql_result_count: int = None
    ) -> AgentLog:
        """
        结束一个操作日志
        
        Args:
            log: AgentLog实例
            output_message: 输出消息
            thinking_content: LLM思考过程
            tool_calls: 工具调用列表
            tool_results: 工具返回结果
            token_usage: Token使用统计
            model_name: 模型名称（用于成本估算）
            success: 是否成功
            error_message: 错误信息
            sql_query: SQL查询
            sql_result_count: SQL返回行数
            
        Returns:
            更新后的AgentLog实例
        """
        log.finished_at = datetime.now()
        log.output_message = output_message
        log.thinking_content = thinking_content
        log.tool_calls = tool_calls
        log.tool_results = tool_results
        log.success = success
        log.error_message = error_message
        log.sql_query = sql_query
        log.sql_result_count = sql_result_count
        
        # 计算执行时间
        if log.created_at:
            log.execution_time_ms = (log.finished_at - log.created_at).total_seconds() * 1000
        
        # Token统计和成本估算
        if token_usage:
            log.token_usage = token_usage
            if model_name:
                prompt_tokens = token_usage.get("prompt_tokens", 0) or token_usage.get("input_tokens", 0)
                completion_tokens = token_usage.get("completion_tokens", 0) or token_usage.get("output_tokens", 0)
                log.estimated_cost = estimate_cost(model_name, prompt_tokens, completion_tokens)
        
        logger.debug(
            f"Ended log: log_id={log.id}, operation={log.operation}, "
            f"success={success}, time_ms={log.execution_time_ms:.2f}"
        )
        
        return log
    
    @staticmethod
    def get_logs(chat_id: int) -> List[AgentLog]:
        """
        获取会话的所有日志
        
        Args:
            chat_id: 会话ID
            
        Returns:
            日志列表
        """
        return _log_store.get(chat_id, [])
    
    @staticmethod
    def get_latest_log(chat_id: int) -> Optional[AgentLog]:
        """
        获取最新的日志
        
        Args:
            chat_id: 会话ID
            
        Returns:
            最新的AgentLog，如果不存在返回None
        """
        logs = _log_store.get(chat_id, [])
        return logs[-1] if logs else None
    
    @staticmethod
    def get_token_stats(chat_id: int) -> Dict[str, Any]:
        """
        获取会话的Token使用统计
        
        Args:
            chat_id: 会话ID
            
        Returns:
            统计信息字典
        """
        logs = _log_store.get(chat_id, [])
        
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cost = 0.0
        operation_stats = {}
        
        for log in logs:
            if log.token_usage:
                prompt = log.token_usage.get("prompt_tokens", 0) or log.token_usage.get("input_tokens", 0)
                completion = log.token_usage.get("completion_tokens", 0) or log.token_usage.get("output_tokens", 0)
                total_prompt_tokens += prompt
                total_completion_tokens += completion
            
            if log.estimated_cost:
                total_cost += log.estimated_cost
            
            # 按操作类型统计
            op = log.operation
            if op not in operation_stats:
                operation_stats[op] = {"count": 0, "tokens": 0, "cost": 0.0}
            operation_stats[op]["count"] += 1
            if log.token_usage:
                operation_stats[op]["tokens"] += (
                    (log.token_usage.get("prompt_tokens", 0) or log.token_usage.get("input_tokens", 0)) +
                    (log.token_usage.get("completion_tokens", 0) or log.token_usage.get("output_tokens", 0))
                )
            if log.estimated_cost:
                operation_stats[op]["cost"] += log.estimated_cost
        
        return {
            "chat_id": chat_id,
            "total_logs": len(logs),
            "total_prompt_tokens": total_prompt_tokens,
            "total_completion_tokens": total_completion_tokens,
            "total_tokens": total_prompt_tokens + total_completion_tokens,
            "total_cost_usd": round(total_cost, 6),
            "operation_stats": operation_stats,
        }
    
    @staticmethod
    def clear_logs(chat_id: int):
        """
        清除会话的所有日志
        
        Args:
            chat_id: 会话ID
        """
        if chat_id in _log_store:
            del _log_store[chat_id]
            logger.debug(f"Cleared logs for chat_id={chat_id}")
    
    @staticmethod
    def export_logs(chat_id: int, format: str = "json") -> str:
        """
        导出会话日志
        
        Args:
            chat_id: 会话ID
            format: 导出格式 (json, markdown)
            
        Returns:
            导出的日志内容
        """
        logs = _log_store.get(chat_id, [])
        
        if format == "json":
            return json.dumps(
                [log.to_dict() for log in logs],
                ensure_ascii=False,
                indent=2,
                default=str
            )
        elif format == "markdown":
            lines = [f"# Agent日志 - 会话 {chat_id}\n"]
            for log in logs:
                lines.append(f"## 步骤 {log.step_index}: {log.operation}")
                lines.append(f"- 时间: {log.created_at}")
                lines.append(f"- 状态: {'成功' if log.success else '失败'}")
                if log.execution_time_ms:
                    lines.append(f"- 耗时: {log.execution_time_ms:.2f}ms")
                if log.token_usage:
                    lines.append(f"- Tokens: {log.token_usage}")
                if log.sql_query:
                    lines.append(f"- SQL: ```sql\n{log.sql_query}\n```")
                if log.error_message:
                    lines.append(f"- 错误: {log.error_message}")
                lines.append("")
            return "\n".join(lines)
        else:
            raise ValueError(f"不支持的格式: {format}")


# 便捷函数
def log_llm_call(
    chat_id: int,
    operation: str,
    messages: List[Any],
    response: Any,
    model_name: str = None
) -> AgentLog:
    """
    便捷函数：记录一次完整的LLM调用
    
    Args:
        chat_id: 会话ID
        operation: 操作类型
        messages: 输入消息
        response: LLM响应
        model_name: 模型名称
        
    Returns:
        AgentLog实例
    """
    # 序列化消息
    serialized_messages = []
    for msg in messages:
        if hasattr(msg, "type") and hasattr(msg, "content"):
            serialized_messages.append({"type": msg.type, "content": msg.content})
        elif isinstance(msg, dict):
            serialized_messages.append(msg)
        else:
            serialized_messages.append({"content": str(msg)})
    
    # 开始日志
    log = AgentLogService.start_log(
        chat_id=chat_id,
        operation=operation,
        input_messages=serialized_messages
    )
    
    # 提取响应信息
    output_message = response.content if hasattr(response, "content") else str(response)
    thinking_content = getattr(response, "reasoning_content", None)
    
    # 提取工具调用
    tool_calls = None
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_calls = [
            {"name": tc.get("name") or getattr(tc, "name", None), 
             "args": tc.get("args") or getattr(tc, "args", None)}
            for tc in response.tool_calls
        ]
    
    # 提取Token使用
    token_usage = None
    if hasattr(response, "usage_metadata"):
        token_usage = response.usage_metadata
    elif hasattr(response, "response_metadata"):
        token_usage = response.response_metadata.get("token_usage")
    
    # 结束日志
    AgentLogService.end_log(
        log=log,
        output_message=output_message,
        thinking_content=thinking_content,
        tool_calls=tool_calls,
        token_usage=token_usage,
        model_name=model_name,
        success=True
    )
    
    return log

