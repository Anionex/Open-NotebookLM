from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from fastapi_app.services.thinkflow_workspace_service import ThinkFlowWorkspaceService

router = APIRouter(prefix="/kb/workspace-items", tags=["ThinkFlow Workspace"])
service = ThinkFlowWorkspaceService()


class CreateWorkspaceItemRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    item_type: str
    title: str = ""
    content: str = ""


class UpdateWorkspaceItemRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class CaptureWorkspaceItemRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    item_type: str
    item_id: Optional[str] = None
    title: str = ""
    text_items: List[str]
    source_refs: Optional[List[Dict[str, Any]]] = None
    prompt: str = ""


class RebuildAllSummaryRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    title: str = "All Summary"


def _effective_user(user_id: str, email: Optional[str]) -> str:
    return (email or user_id or "local").strip() or "local"


@router.get("")
async def list_workspace_items(
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
) -> Dict[str, Any]:
    items = service.list_items(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        item_type=item_type,
    )
    return {"success": True, "items": items}


@router.post("")
async def create_workspace_item(request: CreateWorkspaceItemRequest) -> Dict[str, Any]:
    item = service.create_item(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        item_type=request.item_type,
        title=request.title,
        content=request.content,
    )
    return {"success": True, "item": item}


@router.post("/summary/all/rebuild")
async def rebuild_all_summary(request: RebuildAllSummaryRequest) -> Dict[str, Any]:
    item = service.rebuild_all_summary(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        title=request.title,
    )
    return {"success": True, "item": item}


@router.get("/{item_id}")
async def get_workspace_item(
    item_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    item = service.get_item(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        item_id=item_id,
    )
    return {"success": True, "item": item}


@router.put("/{item_id}")
async def update_workspace_item(item_id: str, request: UpdateWorkspaceItemRequest) -> Dict[str, Any]:
    item = service.update_item(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        item_id=item_id,
        title=request.title,
        content=request.content,
    )
    return {"success": True, "item": item}


@router.delete("/{item_id}")
async def delete_workspace_item(
    item_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    service.delete_item(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        item_id=item_id,
    )
    return {"success": True, "item_id": item_id}


@router.post("/capture")
async def capture_workspace_item(request: CaptureWorkspaceItemRequest) -> Dict[str, Any]:
    item = service.capture_item(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        item_type=request.item_type,
        item_id=request.item_id,
        title=request.title,
        text_items=request.text_items,
        source_refs=request.source_refs,
        prompt=request.prompt,
    )
    return {"success": True, "item": item}
