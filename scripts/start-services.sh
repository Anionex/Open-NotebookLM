#!/bin/bash

# 启动 OpenNotebook 前后端服务的脚本
# 使用 tmux 在不同窗口中运行前端和后端

SESSION_NAME="opennotebook"

# 检查 tmux 会话是否已存在
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Tmux session '$SESSION_NAME' already exists. Attaching..."
    tmux attach-session -t $SESSION_NAME
    exit 0
fi

# 创建新的 tmux 会话
echo "Creating new tmux session '$SESSION_NAME'..."
tmux new-session -d -s $SESSION_NAME -n backend

# 窗口 0: 后端服务 (FastAPI - 端口 8213)
echo "Starting backend service on port 8213..."
tmux send-keys -t $SESSION_NAME:backend "cd /data/users/szl/opennotebook/opennotebookLM" C-m
tmux send-keys -t $SESSION_NAME:backend "conda activate szl-dev" C-m
tmux send-keys -t $SESSION_NAME:backend "uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload" C-m

# 窗口 1: 前端服务 (Vite - 端口 3001)
echo "Starting frontend service on port 3001..."
tmux new-window -t $SESSION_NAME -n frontend
tmux send-keys -t $SESSION_NAME:frontend "cd /data/users/szl/opennotebook/opennotebookLM/frontend_zh" C-m
tmux send-keys -t $SESSION_NAME:frontend "conda activate szl-dev" C-m
tmux send-keys -t $SESSION_NAME:frontend "npm run dev -- --port 3001 --host 0.0.0.0" C-m

# 窗口 2: cpolar
echo "Starting cpolar tunnel on port 3001..."
tmux new-window -t $SESSION_NAME -n cpolar
tmux send-keys -t $SESSION_NAME:cpolar "conda activate szl-dev" C-m
tmux send-keys -t $SESSION_NAME:cpolar "cpolar http 3001" C-m

# 选择第一个窗口（后端）
tmux select-window -t $SESSION_NAME:backend

echo ""
echo "Services started in tmux session '$SESSION_NAME'"
echo ""
echo "Waiting for cpolar to start..."
sleep 5

# 获取公网域名
PUBLIC_URL=$(curl -s http://localhost:4048/http/in 2>/dev/null | grep -oP 'https?://[^"<>]+\.cpolar\.(cn|top|com)' | head -1)

if [ -z "$PUBLIC_URL" ]; then
    # 尝试其他端口
    for port in 4040 4042 4044 4046 4048; do
        PUBLIC_URL=$(curl -s http://localhost:$port/http/in 2>/dev/null | grep -oP 'https?://[^"<>]+\.cpolar\.(cn|top|com)' | head -1)
        if [ -n "$PUBLIC_URL" ]; then
            break
        fi
    done
fi

echo ""
echo "======================================="
echo "  Services Status"
echo "======================================="
echo "Backend  : http://localhost:8213"
echo "Frontend : http://localhost:3001"
if [ -n "$PUBLIC_URL" ]; then
    echo "Public   : $PUBLIC_URL"
else
    echo "Public   : Fetching... (run 'curl -s http://localhost:4048/http/in | grep cpolar' manually)"
fi
echo "======================================="
echo ""
echo "Tmux Windows:"
echo "  - backend  : FastAPI backend"
echo "  - frontend : Vite frontend"
echo "  - cpolar   : Cpolar tunnel"
echo ""
echo "Commands:"
echo "  To attach: tmux attach -t $SESSION_NAME"
echo "  To detach: Ctrl+B then D"
echo "  To switch: Ctrl+B then N (next) or P (previous)"
echo ""

# 自动 attach 到会话
tmux attach-session -t $SESSION_NAME
