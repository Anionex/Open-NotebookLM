from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from fastapi_app.services.conversation_workspace_service import ConversationWorkspaceService
from fastapi_app.services.thinkflow_chat_context_service import ThinkFlowChatContextService

router = APIRouter(prefix="/kb/conversations", tags=["ThinkFlow Conversation Workspace"])
service = ConversationWorkspaceService()
context_service = ThinkFlowChatContextService()


class UpdateConversationWorkspaceStateRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    source_refs: Optional[List[Dict[str, Any]]] = None
    active_document_id: Optional[str] = None
    last_sent_at: Optional[str] = None


class MarkConversationSentRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    sent_at: Optional[str] = None


class BuildChatContextRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    user_message: str
    history: Optional[List[Dict[str, Any]]] = None


def _effective_user(user_id: str, email: Optional[str]) -> str:
    return (email or user_id or "local").strip() or "local"


@router.get("/{conversation_id}/workspace-state")
async def get_conversation_workspace_state(
    conversation_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    state = service.get_state(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        conversation_id=conversation_id,
    )
    return {"success": True, "state": state}


@router.put("/{conversation_id}/workspace-state")
async def update_conversation_workspace_state(
    conversation_id: str,
    request: UpdateConversationWorkspaceStateRequest,
) -> Dict[str, Any]:
    state = service.update_state(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        conversation_id=conversation_id,
        source_refs=request.source_refs,
        active_document_id=request.active_document_id,
        last_sent_at=request.last_sent_at,
    )
    return {"success": True, "state": state}


@router.post("/{conversation_id}/mark-sent")
async def mark_conversation_sent(
    conversation_id: str,
    request: MarkConversationSentRequest,
) -> Dict[str, Any]:
    state = service.mark_sent(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        conversation_id=conversation_id,
        sent_at=request.sent_at,
    )
    return {"success": True, "state": state}


@router.post("/{conversation_id}/chat-context")
async def build_conversation_chat_context(
    conversation_id: str,
    request: BuildChatContextRequest,
) -> Dict[str, Any]:
    context = context_service.build_context(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        conversation_id=conversation_id,
        user_message=request.user_message,
        history=request.history,
    )
    return {"success": True, "context": context}
