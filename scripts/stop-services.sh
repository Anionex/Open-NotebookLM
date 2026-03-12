#!/bin/bash

echo "正在停止服务..."

pkill -f "uvicorn fastapi_app.main:app"
pkill -f "vite.*--port 3001"
pkill -f "cpolar http 3001"

echo "所有服务已停止"
