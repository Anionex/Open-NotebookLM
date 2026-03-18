#!/bin/bash

# 启动后端服务（用于调试）
# 用法: ./start_backend.sh [--tts-gpu 6] [--embedding-gpu 7] [--mineru-gpu 6]

cd "$(dirname "$0")/.."

# 解析GPU参数
TTS_GPU=""
EMBEDDING_GPU=""
MINERU_GPU=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --tts-gpu)
            TTS_GPU="$2"
            shift 2
            ;;
        --embedding-gpu)
            EMBEDDING_GPU="$2"
            shift 2
            ;;
        --mineru-gpu)
            MINERU_GPU="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# 如果指定了GPU，创建.env.local
if [[ -n "$TTS_GPU" ]] || [[ -n "$EMBEDDING_GPU" ]] || [[ -n "$MINERU_GPU" ]]; then
    ENV_LOCAL="fastapi_app/.env.local"
    echo "# GPU configuration for debugging" > "$ENV_LOCAL"

    if [[ -n "$TTS_GPU" ]]; then
        echo "USE_LOCAL_TTS=1" >> "$ENV_LOCAL"
        echo "LOCAL_TTS_CUDA_VISIBLE_DEVICES=$TTS_GPU" >> "$ENV_LOCAL"
        echo "TTS GPU: $TTS_GPU"
    fi

    if [[ -n "$EMBEDDING_GPU" ]]; then
        echo "USE_LOCAL_EMBEDDING=1" >> "$ENV_LOCAL"
        echo "LOCAL_EMBEDDING_CUDA_VISIBLE_DEVICES=$EMBEDDING_GPU" >> "$ENV_LOCAL"
        echo "Embedding GPU: $EMBEDDING_GPU"
    fi

    if [[ -n "$MINERU_GPU" ]]; then
        echo "USE_LOCAL_MINERU=1" >> "$ENV_LOCAL"
        echo "LOCAL_MINERU_CUDA_VISIBLE_DEVICES=$MINERU_GPU" >> "$ENV_LOCAL"
        echo "MinerU GPU: $MINERU_GPU"
    fi
fi

echo "启动后端服务..."
uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload
