"""
对话相关的数据模型
"""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ChatCreateRequest(BaseModel):
    """创建对话请求（不包含问题）"""
    datasource_id: int = Field(..., description="数据源ID")
    chat_title: Optional[str] = Field(None, description="对话标题")


class ChatStartRequest(BaseModel):
    """开始对话请求（包含问题）"""
    datasource_id: int = Field(..., description="数据源ID")
    question: str = Field(..., description="用户问题")
    chat_title: Optional[str] = Field(None, description="对话标题")
    selected_datasource_ids: Optional[List[int]] = Field(
        default=None, description="Optional selected datasource ids for cross-source mode"
    )
    execution_strategy: Optional[str] = Field(
        default=None, description="Optional strategy: auto/ega/legacy"
    )


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str = Field(..., description="角色: user/assistant")
    content: str = Field(..., description="消息内容")
    timestamp: datetime = Field(default_factory=datetime.now)


class ChatResponse(BaseModel):
    """对话响应"""
    chat_id: int
    record_id: Optional[int] = Field(None, description="记录ID（用于CSV导出）")
    message: ChatMessage
    status: str = Field(default="completed", description="状态: processing/completed/error")
    error: Optional[str] = None


class ChatHistory(BaseModel):
    """对话历史"""
    chat_id: int
    title: str
    messages: List[ChatMessage]
    datasource_id: int
    created_at: datetime
    updated_at: datetime


class AnalysisResult(BaseModel):
    """分析结果"""
    question: str
    sql: Optional[str] = None
    result_data: Optional[List[dict]] = None
    summary: Optional[str] = None
    chart_config: Optional[dict] = None  # 用于前端图表配置
    error: Optional[str] = None
