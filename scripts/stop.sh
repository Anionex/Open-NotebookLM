#!/bin/bash

# 递归清理进程树
kill_process_tree() {
    local pid=$1
    local children=$(pgrep -P $pid 2>/dev/null)
    for child in $children; do
        kill_process_tree $child
    done
    kill -9 $pid 2>/dev/null
}

echo "正在停止服务..."

# 停止后端 (端口 8213)
lsof -ti:8213 | xargs kill -9 2>/dev/null
pkill -9 -f "uvicorn fastapi_app.main:app"

# 停止前端 (端口 3001)
lsof -ti:3001 | xargs kill -9 2>/dev/null
pkill -9 -f "vite.*--port 3001"

# 停止监控脚本
pkill -9 -f "bash scripts/monitor.sh" 2>/dev/null

# 停止本项目的 vLLM 进程（清理整个进程树）
for port in 26210 26211; do
    for pid in $(lsof -ti:$port 2>/dev/null); do
        echo "清理端口 $port 的进程树 (PID: $pid)"
        kill_process_tree $pid
    done
done

# 额外清理可能残留的 vLLM 子进程
pkill -9 -f "VLLM::EngineCore" 2>/dev/null
pkill -9 -f "VLLM::Worker" 2>/dev/null

# 停止 tmux 会话
tmux kill-session -t opennotebook 2>/dev/null

echo "所有服务已停止"
