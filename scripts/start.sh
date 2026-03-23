#!/bin/bash

# 快速启动脚本 - 后台启动所有服务
# GPU 配置直接在下方修改，留空则使用 .env 中的配置

# GPU 配置（留空使用 .env 默认配置）
TTS_GPU="6"           # 例如: "6"
EMBEDDING_GPU="7"     # 例如: "7"
MINERU_GPU="6"        # 例如: "6"
CPOLAR_PUBLIC_URL="https://opennotebook.nas.cpolar.cn"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

resolve_backend_python() {
    local candidates=()
    local candidate=""

    if [[ -n "${PYTHON_BIN:-}" ]]; then
        candidates+=("$PYTHON_BIN")
    fi
    if [[ -n "${CONDA_PREFIX:-}" ]]; then
        candidates+=("${CONDA_PREFIX}/bin/python")
    fi
    candidates+=("/root/miniconda3/envs/szl-dev/bin/python")

    candidate="$(command -v python 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        candidates+=("$candidate")
    fi

    candidate="$(command -v python3 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        candidates+=("$candidate")
    fi

    for candidate in "${candidates[@]}"; do
        [[ -n "$candidate" && -x "$candidate" ]] || continue
        if "$candidate" -c "import mineru_vl_utils" >/dev/null 2>&1; then
            echo "$candidate"
            return 0
        fi
    done

    candidate="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        echo "$candidate"
        return 0
    fi

    return 1
}

# 如果指定了 GPU，创建 .env.local 覆盖配置
if [[ -n "$TTS_GPU" ]] || [[ -n "$EMBEDDING_GPU" ]] || [[ -n "$MINERU_GPU" ]]; then
    ENV_LOCAL="$PROJECT_ROOT/fastapi_app/.env.local"
    echo "# Auto-generated GPU configuration" > "$ENV_LOCAL"
    [[ -n "$TTS_GPU" ]] && echo -e "USE_LOCAL_TTS=1\nLOCAL_TTS_CUDA_VISIBLE_DEVICES=$TTS_GPU" >> "$ENV_LOCAL"
    [[ -n "$EMBEDDING_GPU" ]] && echo -e "USE_LOCAL_EMBEDDING=1\nLOCAL_EMBEDDING_CUDA_VISIBLE_DEVICES=$EMBEDDING_GPU" >> "$ENV_LOCAL"
    [[ -n "$MINERU_GPU" ]] && echo -e "USE_LOCAL_MINERU=1\nLOCAL_MINERU_CUDA_VISIBLE_DEVICES=$MINERU_GPU" >> "$ENV_LOCAL"
else
    rm -f "$PROJECT_ROOT/fastapi_app/.env.local"
fi

# 清理端口占用和进程
echo "清理端口占用和进程..."
lsof -ti:8213 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
pkill -9 -f "uvicorn fastapi_app.main:app" 2>/dev/null
pkill -9 -f "vite.*--port 3001" 2>/dev/null
pkill -9 -f "bash scripts/monitor.sh" 2>/dev/null
sleep 2

# 创建日志目录
mkdir -p logs

PYTHON_BIN="$(resolve_backend_python)" || {
    echo "未找到可用的 Python 解释器，无法启动后端"
    exit 1
}

NPM_BIN="$(command -v npm 2>/dev/null || true)"
if [[ -z "$NPM_BIN" ]]; then
    echo "未找到 npm，无法启动前端"
    exit 1
fi

BACKEND_BIN_DIR="$(dirname "$PYTHON_BIN")"

# 后台启动后端
echo "启动后端服务..."
nohup env PATH="$BACKEND_BIN_DIR:$PATH" "$PYTHON_BIN" -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 > logs/backend.log 2>&1 &
BACKEND_PID=$!

# 后台启动前端
echo "启动前端服务..."
cd frontend_zh
nohup "$NPM_BIN" run dev -- --port 3001 --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 启动监控脚本
echo "启动监控服务..."
nohup env PYTHON_BIN="$PYTHON_BIN" NPM_BIN="$NPM_BIN" PATH="$BACKEND_BIN_DIR:$PATH" bash scripts/monitor.sh > /dev/null 2>&1 &
MONITOR_PID=$!

# 等待服务启动
echo "等待服务启动..."
sleep 5

PUBLIC_URL="$CPOLAR_PUBLIC_URL"

# 显示信息
echo ""
echo "======================================="
echo "  OpenNotebook 服务已启动"
echo "======================================="
echo "后端: http://localhost:8213"
echo "前端: http://localhost:3001"
if [ -n "$PUBLIC_URL" ]; then
    echo "公网: $PUBLIC_URL"
else
    echo "公网: $CPOLAR_PUBLIC_URL"
fi
echo "======================================="
echo ""
echo "进程 ID:"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo "  Monitor: $MONITOR_PID"
echo ""
echo "日志文件:"
echo "  Backend: logs/backend.log"
echo "  Frontend: logs/frontend.log"
echo "  Monitor: logs/monitor.log"
echo ""
if [[ -f "$PROJECT_ROOT/fastapi_app/.env.local" ]]; then
    echo "GPU 配置: fastapi_app/.env.local"
    echo ""
fi
echo "停止服务: ./scripts/stop.sh"
echo ""
