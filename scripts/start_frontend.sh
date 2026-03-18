#!/bin/bash

# 启动前端服务（用于调试）

cd "$(dirname "$0")/../frontend_zh"

echo "启动前端服务..."
npm run dev -- --port 3001 --host 0.0.0.0
