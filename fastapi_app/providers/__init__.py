"""
Provider 统一导出接口
根据环境变量自动选择 Embedding / TTS / Search Provider，无需改代码切换。
"""
from fastapi_app.providers.apiyi_embedding import ApiYiEmbeddingProvider
from fastapi_app.providers.openai_embedding import OpenAIEmbeddingProvider
from fastapi_app.providers.apiyi_tts import ApiYiTTSProvider
from fastapi_app.providers.openai_tts import OpenAITTSProvider
from fastapi_app.providers.bailian_tts import BaiLianTTSProvider
from fastapi_app.providers.serper_search import SerperSearchProvider
from fastapi_app.providers.serpapi_search import SerpApiSearchProvider
from fastapi_app.providers.bocha_search import BochaSearchProvider
from fastapi_app.config.settings import settings
from workflow_engine.logger import get_logger

log = get_logger(__name__)

# ── Embedding Provider ────────────────────────────────────────────────────────
# EMBEDDING_PROVIDER: local | openai | apiyi
#   local  → vllm / 本地推理，URL 指向本机，无需 API KEY
#   openai → OpenAI 或兼容接口（Azure 等），需要 KEY
#   apiyi  → ApiYi 代理服务，需要 KEY
_EMBEDDING_PROVIDER = settings.EMBEDDING_PROVIDER.strip().lower()

if _EMBEDDING_PROVIDER == "local":
    embedding_provider = OpenAIEmbeddingProvider(max_retries=3, batch_size=16)
elif _EMBEDDING_PROVIDER == "apiyi":
    embedding_provider = ApiYiEmbeddingProvider(max_retries=3, batch_size=20)
elif _EMBEDDING_PROVIDER == "openai":
    embedding_provider = OpenAIEmbeddingProvider(max_retries=3, batch_size=20)
else:
    log.warning("Unknown EMBEDDING_PROVIDER=%r, falling back to openai-compatible", _EMBEDDING_PROVIDER)
    embedding_provider = OpenAIEmbeddingProvider(max_retries=3, batch_size=20)

log.info("Embedding provider: %s → %s", _EMBEDDING_PROVIDER, type(embedding_provider).__name__)

# ── TTS Provider ──────────────────────────────────────────────────────────────
# TTS_PROVIDER: local | openai | apiyi | bailian
#   local   → 本地 vllm/TTS 服务，URL 指向本机，无需 KEY
#   openai  → OpenAI TTS 或兼容接口
#   apiyi   → ApiYi 代理（内部走 qwen-tts 等）
#   bailian → 阿里云百炼 TTS
_TTS_PROVIDER = settings.TTS_PROVIDER.strip().lower()

if _TTS_PROVIDER == "local":
    tts_provider = OpenAITTSProvider(max_retries=3)
elif _TTS_PROVIDER == "openai":
    tts_provider = OpenAITTSProvider(max_retries=3)
elif _TTS_PROVIDER == "bailian":
    tts_provider = BaiLianTTSProvider(max_retries=3)
else:
    # apiyi 或未知，默认 ApiYi
    if _TTS_PROVIDER not in ("apiyi",):
        log.warning("Unknown TTS_PROVIDER=%r, falling back to apiyi", _TTS_PROVIDER)
    tts_provider = ApiYiTTSProvider(max_retries=3)

log.info("TTS provider: %s → %s", _TTS_PROVIDER, type(tts_provider).__name__)

# ── Search Provider ───────────────────────────────────────────────────────────
# SEARCH_PROVIDER: serper | serpapi | bocha（默认 serper）
_SEARCH_PROVIDERS = {
    "serper": SerperSearchProvider,
    "serpapi": SerpApiSearchProvider,
    "bocha": BochaSearchProvider,
}

_provider_name = settings.SEARCH_PROVIDER.lower()
if _provider_name not in _SEARCH_PROVIDERS:
    log.warning("Unknown SEARCH_PROVIDER=%r, falling back to 'serper'", _provider_name)
    _provider_name = "serper"

search_provider = _SEARCH_PROVIDERS[_provider_name](timeout=30)
log.info("Search provider: %s", _provider_name)
