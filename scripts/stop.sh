#!/bin/bash
# ThinkFlow — 停止所有服务

echo "停止服务..."

lsof -ti:8213 | xargs kill -9 2>/dev/null || true
lsof -ti:3001  | xargs kill -9 2>/dev/null || true
pkill -9 -f "uvicorn fastapi_app.main:app" 2>/dev/null || true
pkill -9 -f "vite.*--port 3001"            2>/dev/null || true
pkill -9 -f "bash scripts/monitor.sh"      2>/dev/null || true
tmux kill-session -t thinkflow             2>/dev/null || true

echo "已停止。"
