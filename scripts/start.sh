#!/bin/bash
# ThinkFlow — 启动前后端服务（后台模式）
# 用法: ./scripts/start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Python 解析 ───────────────────────────────────────────────────────────────
resolve_python() {
    local candidates=(
        "${CONDA_PREFIX:-}/bin/python"
        "/root/miniconda3/envs/szl-dev/bin/python"
        "$(command -v python3 2>/dev/null || true)"
        "$(command -v python 2>/dev/null || true)"
    )
    for p in "${candidates[@]}"; do
        [[ -x "$p" ]] && echo "$p" && return 0
    done
    echo "错误: 找不到可用的 Python" >&2; return 1
}

PYTHON_BIN="$(resolve_python)"
NPM_BIN="$(command -v npm 2>/dev/null)" || { echo "错误: 找不到 npm"; exit 1; }

# ── 清理旧进程 ────────────────────────────────────────────────────────────────
echo "清理旧进程..."
lsof -ti:8213 | xargs kill -9 2>/dev/null || true
lsof -ti:3001  | xargs kill -9 2>/dev/null || true
pkill -9 -f "uvicorn fastapi_app.main:app" 2>/dev/null || true
pkill -9 -f "vite.*--port 3001"            2>/dev/null || true
pkill -9 -f "bash scripts/monitor.sh"      2>/dev/null || true
sleep 1

# ── 启动服务 ──────────────────────────────────────────────────────────────────
mkdir -p logs

echo "启动后端 (port 8213)..."
nohup "$PYTHON_BIN" -m uvicorn fastapi_app.main:app \
    --host 0.0.0.0 --port 8213 \
    > logs/backend.log 2>&1 &
BACKEND_PID=$!

echo "启动前端 (port 3001)..."
cd frontend_zh
nohup "$NPM_BIN" run dev -- --port 3001 --host 0.0.0.0 \
    > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "启动监控..."
nohup env PYTHON_BIN="$PYTHON_BIN" NPM_BIN="$NPM_BIN" \
    bash scripts/monitor.sh > /dev/null 2>&1 &
MONITOR_PID=$!

# ── 等待并打印状态 ────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "======================================="
echo "  ThinkFlow 已启动"
echo "======================================="
echo "  后端: http://localhost:8213"
echo "  前端: http://localhost:3001"
echo "  PID:  backend=$BACKEND_PID  frontend=$FRONTEND_PID  monitor=$MONITOR_PID"
echo "  日志: logs/backend.log  logs/frontend.log"
echo "  停止: ./scripts/stop.sh"
echo "======================================="
