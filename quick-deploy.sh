#!/bin/bash

echo "🚀 梯桁筋与组合肋生产管理系统 - 快速部署脚本"
echo "=================================================="

# 检查是否安装了必要的工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 未安装，请先安装 $1"
        return 1
    else
        echo "✅ $1 已安装"
        return 0
    fi
}

# 选择部署方案
echo ""
echo "请选择部署方案："
echo "1. Vercel 部署（推荐）"
echo "2. Netlify 部署"
echo "3. 本地网络部署"
echo "4. 生成部署包"

read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🔄 准备 Vercel 部署..."
        
        if check_command "vercel"; then
            echo "开始部署到 Vercel..."
            vercel --prod
        else
            echo "请先安装 Vercel CLI："
            echo "npm i -g vercel"
        fi
        ;;
    2)
        echo ""
        echo "🔄 准备 Netlify 部署包..."
        
        # 创建部署包
        zip -r production-system-netlify.zip . -x "*.git*" "node_modules/*" "*.DS_Store" "deploy.sh" "quick-deploy.sh"
        
        echo "✅ 部署包已创建: production-system-netlify.zip"
        echo "请访问 https://netlify.com 并拖拽此文件进行部署"
        ;;
    3)
        echo ""
        echo "🔄 启动本地网络服务器..."
        
        # 获取本机IP
        if [[ "$OSTYPE" == "darwin"* ]]; then
            LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        else
            LOCAL_IP=$(hostname -I | awk '{print $1}')
        fi
        
        echo "本地IP地址: $LOCAL_IP"
        echo "团队成员可通过以下地址访问："
        echo "http://$LOCAL_IP:3000"
        echo ""
        echo "按 Ctrl+C 停止服务器"
        
        # 启动服务器
        if check_command "python3"; then
            python3 -m http.server 3000
        elif check_command "python"; then
            python -m http.server 3000
        else
            echo "❌ 未找到 Python，请安装 Python"
        fi
        ;;
    4)
        echo ""
        echo "🔄 生成部署包..."
        
        # 创建部署包
        zip -r production-system-deploy.zip . -x "*.git*" "node_modules/*" "*.DS_Store" "deploy.sh" "quick-deploy.sh"
        
        echo "✅ 部署包已创建: production-system-deploy.zip"
        echo "可以将此文件上传到任何静态网站托管服务"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "🎉 部署脚本执行完成！"
