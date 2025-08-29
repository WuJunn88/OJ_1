#!/bin/bash

# 后端启动脚本 - 确保环境变量被正确加载

echo "🚀 启动OJ系统后端服务..."

# 检查环境变量
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ 错误: DEEPSEEK_API_KEY 环境变量未设置"
    echo "请先设置环境变量:"
    echo "export DEEPSEEK_API_KEY='你的实际密钥'"
    echo "export DEEPSEEK_API_BASE='https://api.deepseek.com/v1'"
    exit 1
fi

echo "✅ DEEPSEEK_API_KEY 已设置"
echo "✅ DEEPSEEK_API_BASE: ${DEEPSEEK_API_BASE:-https://api.deepseek.com/v1}"

# 切换到项目目录
cd "$(dirname "$0")"

# 启动后端服务
echo "🔧 启动后端服务..."
python3 backend/main-service/app.py
