import logging
import os
import contextvars
from logging.handlers import RotatingFileHandler

DEFAULT_LOG_FILE = os.getenv("DATAFLOW_LOG_FILE", "dataflow_agent.log")
DEFAULT_LOG_LEVEL = os.getenv("DATAFLOW_LOG_LEVEL", "INFO").upper()
MAX_LOG_SIZE = 10 * 1024 * 1024
BACKUP_COUNT = 5

# Context variables for request tracking
request_id_var = contextvars.ContextVar('request_id', default=None)
user_id_var = contextvars.ContextVar('user_id', default=None)
user_email_var = contextvars.ContextVar('user_email', default=None)


def set_request_context(request_id=None, user_id=None, user_email=None):
    """Set request context for logging."""
    if request_id:
        request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if user_email:
        user_email_var.set(user_email)

# ANSI 颜色码
COLOR_MAP = {
    "DEBUG": "\033[46m\033[30m",    # 青色底黑字
    "INFO": "\033[32m",              # 绿色
    "WARNING": "\033[43m\033[30m",   # 黄色底黑字
    "ERROR": "\033[31m",             # 红色
    "CRITICAL": "\033[41m\033[37m",  # 红底白字
    "RESET": "\033[0m",
}

# 字段颜色
FIELD_COLORS = {
    "time": "\033[90m",      # 灰色
    "name": "\033[35m",      # 紫色/洋红
    "location": "\033[96m",  # 亮青色
}

class ColorFormatter(logging.Formatter):
    """
    支持不同字段高亮显示的 Formatter,仅限控制台输出。
    """
    def format(self, record):
        level_name = record.levelname
        level_color = COLOR_MAP.get(level_name, "")
        reset = COLOR_MAP["RESET"]

        # 格式化各个字段
        asctime = self.formatTime(record, self.datefmt)
        levelname = record.levelname
        name = record.name
        filename = record.filename
        lineno = record.lineno
        message = record.getMessage()

        # 获取上下文信息
        req_id = request_id_var.get()
        user_email = user_email_var.get()
        user_id = user_id_var.get()

        # 构建上下文字符串
        context_parts = []
        if req_id:
            context_parts.append(f"req={req_id[:8]}")
        if user_email:
            context_parts.append(f"user={user_email}")
        elif user_id:
            context_parts.append(f"uid={user_id}")

        context_str = f" [{' '.join(context_parts)}]" if context_parts else ""

        # 组合带颜色的输出 - 每个字段不同颜色
        formatted = (
            f"{FIELD_COLORS['time']}{asctime}{reset} | "
            f"{level_color}{levelname:<8}{reset} | "
            f"{FIELD_COLORS['name']}{name}{context_str}{reset} | "
            f"{FIELD_COLORS['location']}{filename}:{lineno}{reset} | "
            f"{level_color}{message}{reset}"  # 消息使用级别颜色
        )

        return formatted

def _create_handler():
    """创建控制台和文件的日志处理器。"""
    # 控制台输出（带颜色）
    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(DEFAULT_LOG_LEVEL)
    color_formatter = ColorFormatter(datefmt="%Y-%m-%d %H:%M:%S")
    stream_handler.setFormatter(color_formatter)

    # 文件输出（不带颜色，但包含上下文）
    file_handler = RotatingFileHandler(DEFAULT_LOG_FILE, maxBytes=MAX_LOG_SIZE, backupCount=BACKUP_COUNT, encoding="utf-8")
    file_handler.setLevel(DEFAULT_LOG_LEVEL)

    class PlainContextFormatter(logging.Formatter):
        """Plain formatter with context support for file output."""
        def format(self, record):
            # 获取上下文信息
            req_id = request_id_var.get()
            user_email = user_email_var.get()
            user_id = user_id_var.get()

            # 构建上下文字符串
            context_parts = []
            if req_id:
                context_parts.append(f"req={req_id[:8]}")
            if user_email:
                context_parts.append(f"user={user_email}")
            elif user_id:
                context_parts.append(f"uid={user_id}")

            context_str = f" [{' '.join(context_parts)}]" if context_parts else ""

            # 添加上下文到 record.name
            original_name = record.name
            record.name = f"{original_name}{context_str}"
            result = super().format(record)
            record.name = original_name  # 恢复原始值
            return result

    plain_formatter = PlainContextFormatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(plain_formatter)
    return [stream_handler, file_handler]

def get_logger(name: str = "dataflow_agent") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handlers = _create_handler()
        for handler in handlers:
            logger.addHandler(handler)
        logger.setLevel(DEFAULT_LOG_LEVEL)
        logger.propagate = False
    return logger

log = get_logger()

if __name__ == "__main__":
    log.info("Logger 初始化成功")
    log.debug("This is a debug message.")
    log.warning("This is a warning.")
    log.error("This is an error.")
    log.critical("This is CRITICAL!")