import logging
from typing import Optional
from pathlib import Path
from langchain_chroma import Chroma
# from langchain_openai import OpenAIEmbeddings # Deprecated for this env
from langchain_community.embeddings import HuggingFaceEmbeddings
from sqlbot_backend.core.config import settings
from .storage import rag_dir

logger = logging.getLogger(__name__)

class VectorStoreManager:
    _instance = None
    _embeddings = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VectorStoreManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        try:
            # P2优化: 使用中文优化的向量模型
            # 优先级: 中文专用模型 > 多语言模型 > 英文模型(备选)

            model_candidates = [
                # 最佳: 中文专用模型 (推荐)
                {
                    "name": "shibing624/text2vec-base-chinese",
                    "description": "中文专用模型, 768维, 适合中文语义检索"
                },
                # 备选1: 多语言模型
                {
                    "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                    "description": "多语言模型, 384维, 支持50+语言"
                },
                # 备选2: 原始英文模型
                {
                    "name": "sentence-transformers/all-MiniLM-L6-v2",
                    "description": "英文模型, 384维, 轻量级"
                }
            ]

            model_name = None
            for candidate in model_candidates:
                try:
                    logger.info(f"Trying model: {candidate['name']} - {candidate['description']}")

                    model_kwargs = {'device': 'cpu'}
                    encode_kwargs = {'normalize_embeddings': False}

                    # 尝试初始化模型
                    embeddings = HuggingFaceEmbeddings(
                        model_name=candidate['name'],
                        model_kwargs=model_kwargs,
                        encode_kwargs=encode_kwargs
                    )

                    # 测试模型是否可用
                    test_result = embeddings.embed_query("测试")
                    if len(test_result) > 0:
                        self._embeddings = embeddings
                        model_name = candidate['name']
                        logger.info(f"✓ Successfully loaded model: {model_name}")
                        break

                except Exception as e:
                    logger.warning(f"✗ Failed to load {candidate['name']}: {e}")
                    continue

            if not model_name:
                logger.warning("All embedding models failed to load - vector store will be unavailable")
                self._embeddings = None
                self.persist_directory = None
                self.model_name = None
                return  # Allow initialization to complete without error

            # 持久化目录(avoid CWD ambiguity)
            persist_path = rag_dir("chroma_db")
            try:
                persist_path.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            persist_directory = str(persist_path.absolute())
            self.persist_directory = persist_directory
            self.model_name = model_name

            logger.info(f"Initialized VectorStoreManager with:")
            logger.info(f"  - Model: {model_name}")
            logger.info(f"  - Persist directory: {persist_directory}")

        except Exception as e:
            logger.error(f"Failed to initialize VectorStoreManager: {e}")
            raise

    def get_vector_store(self, collection_name: str) -> Optional[Chroma]:
        """
        Return a Chroma vector store, or None when embeddings are unavailable.

        NOTE: Constructing Chroma with embedding_function=None will later crash with
        'You must provide an embedding function to compute embeddings'.
        """
        if not self._embeddings or not getattr(self, "persist_directory", None):
            logger.warning(
                f"Vector store unavailable (collection={collection_name}): embeddings not initialized"
            )
            return None

        return Chroma(
            collection_name=collection_name,
            embedding_function=self._embeddings,
            persist_directory=self.persist_directory,
        )

# 全局实例
vector_store_manager = VectorStoreManager()
