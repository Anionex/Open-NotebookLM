#!/bin/bash

# 停止 OpenNotebook 服务的脚本

SESSION_NAME="opennotebook"

echo "Stopping OpenNotebook services..."

# 停止端口 3001 和 8213 上的进程
echo "Killing processes on ports 3001 and 8213..."
lsof -ti:3001 -ti:8213 2>/dev/null | xargs -r kill -9

# 关闭 tmux 会话
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Killing tmux session '$SESSION_NAME'..."
    tmux kill-session -t $SESSION_NAME
fi

echo "All services stopped."
