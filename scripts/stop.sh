#!/bin/bash

echo "正在停止服务..."

# 停止后端 (端口 8213)
lsof -ti:8213 | xargs kill -9 2>/dev/null
pkill -9 -f "uvicorn fastapi_app.main:app"

# 停止前端 (端口 3001)
lsof -ti:3001 | xargs kill -9 2>/dev/null
pkill -9 -f "vite.*--port 3001"

# 停止 cpolar
pkill -9 -f "cpolar http 3001"

# 停止 tmux 会话
tmux kill-session -t opennotebook 2>/dev/null

echo "所有服务已停止"
