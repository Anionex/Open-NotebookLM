import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from workflow_engine.logger import get_logger, set_request_context

log = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request logging and context tracking."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        user_email = None
        user_id = None

        try:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                import base64
                import json
                token = auth_header.split(" ", 1)[1]
                parts = token.split(".")
                if len(parts) >= 2:
                    payload_b64 = parts[1]
                    payload_b64 += "=" * (4 - len(payload_b64) % 4)
                    decoded = json.loads(base64.urlsafe_b64decode(payload_b64))
                    user_email = decoded.get("email")
                    user_id = decoded.get("sub") or decoded.get("user_id")
        except Exception:
            pass

        set_request_context(request_id=request_id, user_id=user_id, user_email=user_email)
        log.info(f"{request.method} {request.url.path}")

        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        log.info(f"{request.method} {request.url.path} - {response.status_code} ({duration:.3f}s)")
        return response
