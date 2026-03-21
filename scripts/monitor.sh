#!/bin/bash
# 监控并自动重启后端服务

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

while true; do
    if ! pgrep -f "uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213" > /dev/null; then
        echo "[$(date)] Backend crashed, restarting..." >> logs/monitor.log

        # 清理端口
        lsof -ti:8213 | xargs kill -9 2>/dev/null
        sleep 2

        # 重启后端
        nohup uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 >> logs/backend.log 2>&1 &
        echo "[$(date)] Backend restarted with PID $!" >> logs/monitor.log
    fi

    sleep 30
done
