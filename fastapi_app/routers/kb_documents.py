from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from fastapi_app.services.document_service import DocumentService

router = APIRouter(prefix="/kb/documents", tags=["Knowledge Base Documents"])
service = DocumentService()


class CreateDocumentRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    title: str = "梳理文档"
    content: str = ""


class UpdateDocumentRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class PushDocumentRequest(BaseModel):
    notebook_id: str
    notebook_title: str = ""
    user_id: str = "local"
    email: Optional[str] = None
    mode: str = "append"
    title: str = "新增整理"
    text_items: List[str]
    source_refs: Optional[List[Dict[str, Any]]] = None
    prompt: str = ""
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None


def _effective_user(user_id: str, email: Optional[str]) -> str:
    return (email or user_id or "local").strip() or "local"


@router.get("")
async def list_documents(
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    items = service.list_documents(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
    )
    return {"success": True, "documents": items}


@router.post("")
async def create_document(request: CreateDocumentRequest) -> Dict[str, Any]:
    document = service.create_document(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        title=request.title,
        content=request.content,
    )
    return {"success": True, "document": document}


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    document = service.get_document(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        document_id=document_id,
    )
    return {"success": True, "document": document}


@router.put("/{document_id}")
async def update_document(document_id: str, request: UpdateDocumentRequest) -> Dict[str, Any]:
    document = service.update_document(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        document_id=document_id,
        title=request.title,
        content=request.content,
    )
    return {"success": True, "document": document}


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    service.delete_document(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        document_id=document_id,
    )
    return {"success": True, "document_id": document_id}


@router.post("/{document_id}/push")
async def push_document(document_id: str, request: PushDocumentRequest) -> Dict[str, Any]:
    result = service.push_document(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        document_id=document_id,
        mode=request.mode,
        title=request.title,
        text_items=request.text_items,
        source_refs=request.source_refs,
        prompt=request.prompt,
        api_url=request.api_url,
        api_key=request.api_key,
        model=request.model,
    )
    return {"success": True, **result}


@router.get("/{document_id}/versions")
async def list_versions(
    document_id: str,
    notebook_id: str = Query(...),
    notebook_title: str = Query(""),
    user_id: str = Query("local"),
    email: Optional[str] = Query(None),
) -> Dict[str, Any]:
    items = service.list_versions(
        notebook_id=notebook_id,
        notebook_title=notebook_title,
        user_id=_effective_user(user_id, email),
        document_id=document_id,
    )
    return {"success": True, "versions": items}


@router.post("/{document_id}/restore/{version_id}")
async def restore_version(
    document_id: str,
    version_id: str,
    request: UpdateDocumentRequest,
) -> Dict[str, Any]:
    document = service.restore_version(
        notebook_id=request.notebook_id,
        notebook_title=request.notebook_title,
        user_id=_effective_user(request.user_id, request.email),
        document_id=document_id,
        version_id=version_id,
    )
    return {"success": True, "document": document}
