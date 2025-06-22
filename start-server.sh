#!/bin/bash

echo "🌐 启动局域网生产管理系统服务器"
echo "========================================"
echo ""

# 获取本机IP地址
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    # 其他系统
    LOCAL_IP="localhost"
fi

echo "📍 本机IP地址: $LOCAL_IP"
echo "🌐 团队访问地址: http://$LOCAL_IP:8080"
echo ""
echo "📋 使用说明:"
echo "  1. 保持此终端窗口打开"
echo "  2. 团队成员在浏览器中访问上述地址"
echo "  3. 支持手机、平板、电脑访问"
echo "  4. 按 Ctrl+C 停止服务器"
echo ""
echo "🚀 正在启动服务器..."
echo ""

# 尝试启动Python HTTP服务器
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    python -m http.server 8080
else
    echo "❌ 未找到Python，请先安装Python"
    echo "📥 安装命令:"
    echo "  Ubuntu/Debian: sudo apt install python3"
    echo "  CentOS/RHEL: sudo yum install python3"
    echo "  macOS: brew install python3"
    exit 1
fi
