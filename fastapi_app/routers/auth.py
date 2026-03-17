"""
Auth configuration and proxy endpoints.
All Supabase auth requests go through backend.
"""
from fastapi import APIRouter, HTTPException, Response, Request
from typing import Dict, Any
from pydantic import BaseModel
from fastapi_app.dependencies.auth import get_supabase_client
import logging

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.get("/config")
async def get_auth_config() -> Dict[str, Any]:
    """
    Check if Supabase is configured.
    Frontend no longer needs Supabase credentials.
    """
    supabase = get_supabase_client()
    configured = supabase is not None

    return {
        "supabaseConfigured": configured,
        "authMode": "backend-proxy"  # 告诉前端使用后端代理模式
    }


@router.post("/login")
async def login(request: LoginRequest, response: Response) -> Dict[str, Any]:
    """Login via backend proxy"""
    log.info(f"Login attempt for email: {request.email}")
    supabase = get_supabase_client()
    if not supabase:
        log.error("Supabase client not configured")
        raise HTTPException(status_code=503, detail="Auth not configured")

    log.info(f"Supabase client: {type(supabase)}")
    try:
        log.info("Calling supabase.auth.sign_in_with_password")
        result = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        log.info(f"Login result: {result}")

        if result.session:
            # 设置 HTTP-only cookie
            response.set_cookie(
                key="sb-access-token",
                value=result.session.access_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=result.session.expires_in
            )
            response.set_cookie(
                key="sb-refresh-token",
                value=result.session.refresh_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 30  # 30 days
            )

            return {
                "success": True,
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                }
            }
        else:
            raise HTTPException(status_code=401, detail="Login failed")
    except Exception as e:
        log.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signup")
async def signup(request: SignupRequest, response: Response) -> Dict[str, Any]:
    """Signup via backend proxy"""
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth not configured")

    try:
        result = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password
        })

        if result.session:
            response.set_cookie(
                key="sb-access-token",
                value=result.session.access_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=result.session.expires_in
            )
            response.set_cookie(
                key="sb-refresh-token",
                value=result.session.refresh_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 30
            )

            return {
                "success": True,
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                }
            }
        else:
            return {"success": True, "message": "Check your email for confirmation"}
    except Exception as e:
        log.error(f"Signup error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refresh")
async def refresh_token(request: Request, response: Response) -> Dict[str, Any]:
    """Refresh token via backend proxy"""
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Auth not configured")

    refresh_token = request.cookies.get("sb-refresh-token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        result = supabase.auth.refresh_session(refresh_token)

        if result.session:
            response.set_cookie(
                key="sb-access-token",
                value=result.session.access_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=result.session.expires_in
            )
            response.set_cookie(
                key="sb-refresh-token",
                value=result.session.refresh_token,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 30
            )

            return {
                "success": True,
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                }
            }
        else:
            raise HTTPException(status_code=401, detail="Refresh failed")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout(response: Response) -> Dict[str, Any]:
    """Logout via backend proxy"""
    response.delete_cookie("sb-access-token")
    response.delete_cookie("sb-refresh-token")
    return {"success": True}


@router.get("/session")
async def get_session(request: Request) -> Dict[str, Any]:
    """Get current session via backend proxy"""
    supabase = get_supabase_client()
    if not supabase:
        return {"user": None}

    access_token = request.cookies.get("sb-access-token")
    if not access_token:
        return {"user": None}

    try:
        result = supabase.auth.get_user(access_token)
        if result.user:
            return {
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                }
            }
        else:
            return {"user": None}
    except Exception:
        return {"user": None}

