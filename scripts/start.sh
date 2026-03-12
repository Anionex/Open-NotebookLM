#!/bin/bash

# 快速启动脚本 - 后台启动所有服务并显示访问信息

cd /data/users/szl/opennotebook/opennotebookLM

# 清理端口占用
echo "清理端口占用..."
lsof -ti:8213 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
pkill -9 -f "uvicorn fastapi_app.main:app" 2>/dev/null
pkill -9 -f "vite.*--port 3001" 2>/dev/null
pkill -9 -f "cpolar http 3001" 2>/dev/null
sleep 1

# 后台启动后端
echo "启动后端服务..."
nohup uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload > logs/backend.log 2>&1 &
BACKEND_PID=$!

# 后台启动前端
echo "启动前端服务..."
cd frontend_zh
nohup npm run dev -- --port 3001 --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 后台启动 cpolar
echo "启动 cpolar 隧道..."
nohup cpolar http 3001 > logs/cpolar.log 2>&1 &
CPOLAR_PID=$!

# 等待服务启动
echo "等待服务启动..."
sleep 12

# 获取公网地址
PUBLIC_URL=""
for i in {1..8}; do
    PUBLIC_URL=$(curl -s http://localhost:4048/http/in 2>/dev/null | grep -oP 'https?://[^"<>]+\.cpolar\.(cn|top|com)' | head -1)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
    sleep 2
done

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
    echo "公网: 获取中... (稍后运行: curl -s http://localhost:4048/http/in | grep cpolar)"
fi
echo "======================================="
echo ""
echo "进程 ID:"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo "  Cpolar: $CPOLAR_PID"
echo ""
echo "日志文件:"
echo "  Backend: logs/backend.log"
echo "  Frontend: logs/frontend.log"
echo "  Cpolar: logs/cpolar.log"
echo ""
echo "停止服务: ./scripts/stop-services.sh"
echo ""
