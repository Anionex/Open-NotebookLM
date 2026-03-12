#!/bin/bash

cd /data/users/szl/opennotebook/opennotebookLM

# 后台启动后端
nohup uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8213 --reload > logs/backend.log 2>&1 &
BACKEND_PID=$!

# 后台启动前端
cd frontend_zh
nohup npm run dev -- --port 3001 --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 后台启动 cpolar
nohup cpolar http 3001 > logs/cpolar.log 2>&1 &
CPOLAR_PID=$!

echo "等待服务启动..."
sleep 10

# 获取公网地址
PUBLIC_URL=""
for i in {1..6}; do
    PUBLIC_URL=$(curl -s http://localhost:4048/http/in 2>/dev/null | grep -oP 'https?://[^"<>]+\.cpolar\.(cn|top|com)' | head -1)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
    sleep 2
done

echo ""
echo "======================================="
echo "  服务已启动"
echo "======================================="
echo "后端: http://localhost:8213"
echo "前端: http://localhost:3001"
echo "公网: ${PUBLIC_URL:-获取中...}"
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
