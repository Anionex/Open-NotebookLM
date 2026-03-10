"""
Auth configuration endpoint.
"""
import os
from fastapi import APIRouter
from typing import Dict, Any, Optional
from fastapi_app.dependencies.auth import get_supabase_client

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/config")
async def get_auth_config() -> Dict[str, Any]:
    """
    Check if Supabase is configured and return config.
    Frontend calls this to determine if auth is available and get credentials.
    """
    supabase = get_supabase_client()
    configured = supabase is not None

    result: Dict[str, Any] = {
        "supabaseConfigured": configured
    }

    if configured:
        # Return Supabase URL and anon key for frontend to use
        result["supabaseUrl"] = os.getenv("SUPABASE_URL")
        result["supabaseAnonKey"] = os.getenv("SUPABASE_ANON_KEY")

    return result
