"""
Application Settings

Model configurations are used as Pydantic defaults in schemas.py.
Frontend typically overrides these values, but they're kept for API compatibility.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class AppSettings(BaseSettings):
    """Application configuration with environment variable support."""

    # API Configuration
    DEFAULT_LLM_API_URL: str = "http://123.129.219.111:3000/v1/"

    # Model defaults (used in schemas.py, typically overridden by frontend)
    MODEL_GPT_4O: str = "deepseek-v3.2"
    PAPER2VIDEO_DEFAULT_MODEL: str = "deepseek-v3.2"

    # Paper2PPT models
    PAPER2PPT_DEFAULT_MODEL: str = "deepseek-v3.2"
    PAPER2PPT_OUTLINE_MODEL: str = "deepseek-v3.2"
    PAPER2PPT_CONTENT_MODEL: str = "deepseek-v3.2"
    PAPER2PPT_IMAGE_GEN_MODEL: str = "gemini-3-pro-image-preview"
    PAPER2PPT_VLM_MODEL: str = "qwen-vl-ocr-2025-11-20"
    PAPER2PPT_CHART_MODEL: str = "deepseek-v3.2"
    PAPER2PPT_DESC_MODEL: str = "deepseek-v3.2"
    PAPER2PPT_TECHNICAL_MODEL: str = "deepseek-v3.2"

    # Paper2Figure models
    PAPER2FIGURE_TEXT_MODEL: str = "deepseek-v3.2"
    PAPER2FIGURE_IMAGE_MODEL: str = "gemini-3-pro-image-preview"
    PAPER2FIGURE_VLM_MODEL: str = "qwen-vl-ocr-2025-11-20"
    PAPER2FIGURE_CHART_MODEL: str = "deepseek-v3.2"
    PAPER2FIGURE_DESC_MODEL: str = "deepseek-v3.2"
    PAPER2FIGURE_REF_IMG_DESC_MODEL: str = "deepseek-v3.2"
    PAPER2FIGURE_TECHNICAL_MODEL: str = "deepseek-v3.2"

    # Knowledge Base
    KB_CHAT_MODEL: str = "deepseek-v3.2"

    # Search API
    SERPER_API_KEY: Optional[str] = None

    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # TTS
    USE_LOCAL_TTS: int = 0
    TTS_ENGINE: str = "qwen"
    TTS_IDLE_TIMEOUT: int = 300
    LOCAL_TTS_MODEL: str = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    LOCAL_TTS_PORT: int = 26211
    LOCAL_TTS_CMD: str = "vllm-omni"
    LOCAL_TTS_CUDA_VISIBLE_DEVICES: Optional[str] = None
    LOCAL_TTS_GPU_MEMORY_UTILIZATION: float = 0.3

    # Local Embedding
    USE_LOCAL_EMBEDDING: int = 1
    LOCAL_EMBEDDING_MODEL: str = "Octen/Octen-Embedding-0.6B"
    LOCAL_EMBEDDING_PORT: int = 26210
    LOCAL_EMBEDDING_CMD: str = "vllm"
    LOCAL_EMBEDDING_CUDA_VISIBLE_DEVICES: Optional[str] = None
    LOCAL_EMBEDDING_GPU_MEMORY_UTILIZATION: float = 0.3

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global configuration instance
settings = AppSettings()
