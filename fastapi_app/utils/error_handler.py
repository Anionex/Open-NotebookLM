from fastapi import HTTPException
from workflow_engine.logger import get_logger

log = get_logger(__name__)


def handle_exception(
    e: Exception,
    context: str,
    user_message: str = "操作失败",
    status_code: int = 500,
    log_level: str = "error"
) -> HTTPException:
    """
    Handle exception with detailed logging and safe user message.

    Args:
        e: The exception to handle
        context: Context description for logging
        user_message: Safe message to return to user
        status_code: HTTP status code
        log_level: Logging level (error, warning, info, debug)

    Returns:
        HTTPException with safe user message
    """
    logger_func = getattr(log, log_level)
    logger_func(f"{context} 失败: {type(e).__name__}: {str(e)}", exc_info=True)
    return HTTPException(status_code=status_code, detail=user_message)
