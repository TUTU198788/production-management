#!/bin/bash

# 生产管理系统 - Mac一键部署工具

clear
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    梯桁筋与组合肋生产管理系统                    ║"
echo "║                      Mac一键部署工具                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_menu() {
    echo "🎯 选择部署方式："
    echo ""
    echo "   1. 启动HTTP服务器（推荐）"
    echo "   2. 生成NAS部署包"
    echo "   3. 查看部署指南"
    echo "   4. 测试系统功能"
    echo "   5. 退出"
    echo ""
    read -p "请输入选项 (1-5): " choice
    
    case $choice in
        1) start_server ;;
        2) create_nas_package ;;
        3) show_guide ;;
        4) test_system ;;
        5) exit_script ;;
        *) 
            echo -e "${RED}❌ 无效选项，请重新选择${NC}"
            echo ""
            read -p "按回车键继续..."
            show_menu
            ;;
    esac
}

start_server() {
    echo ""
    echo "🚀 启动HTTP服务器..."
    echo "=================="
    echo ""
    
    # 获取本机IP地址
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi
    
    echo -e "${BLUE}📍 服务器信息:${NC}"
    echo "   - 本机IP: $LOCAL_IP"
    echo "   - 端口: 8080"
    echo "   - 访问地址: http://$LOCAL_IP:8080"
    echo ""
    echo -e "${YELLOW}📋 团队使用说明:${NC}"
    echo "   1. 确保所有设备连接同一WiFi/局域网"
    echo "   2. 在浏览器中访问: http://$LOCAL_IP:8080"
    echo "   3. 支持电脑、手机、平板访问"
    echo "   4. 按 Ctrl+C 停止服务器"
    echo ""
    echo -e "${GREEN}🌐 正在启动服务器，请稍候...${NC}"
    echo ""
    
    # 检查Python版本并启动服务器
    if command -v python3 &> /dev/null; then
        echo "使用 Python3 启动服务器..."
        python3 -m http.server 8080
    elif command -v python &> /dev/null; then
        echo "使用 Python 启动服务器..."
        python -m http.server 8080
    else
        echo -e "${RED}❌ 启动失败：未找到Python${NC}"
        echo ""
        echo "📥 解决方案："
        echo "   1. 安装Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo "   2. 安装Python: brew install python3"
        echo "   3. 重新运行此脚本"
        echo ""
        read -p "按回车键返回菜单..."
        show_menu
    fi
}

create_nas_package() {
    echo ""
    echo "📦 生成NAS部署包..."
    echo "=================="
    echo ""
    
    PACKAGE_NAME="生产管理系统-NAS部署包.zip"
    
    if [ -f "$PACKAGE_NAME" ]; then
        rm "$PACKAGE_NAME"
    fi
    
    # 创建ZIP包，排除不需要的文件
    if command -v zip &> /dev/null; then
        zip -r "$PACKAGE_NAME" . -x "*.sh" "*.zip" ".git/*" "node_modules/*" ".DS_Store"
        echo -e "${GREEN}✅ NAS部署包已生成: $PACKAGE_NAME${NC}"
    else
        echo -e "${RED}❌ 未找到zip命令${NC}"
        echo ""
        echo "📋 手动打包步骤："
        echo "   1. 在Finder中选择所有文件和文件夹"
        echo "   2. 右键选择'压缩项目'"
        echo "   3. 排除: *.sh, *.zip, .git, node_modules, .DS_Store"
        echo "   4. 上传到NAS的Web目录"
    fi
    
    echo ""
    echo -e "${BLUE}📋 NAS部署步骤:${NC}"
    echo "   1. 将ZIP文件解压到NAS的Web目录"
    echo "   2. 群晖NAS: /volume1/web/"
    echo "   3. 威联通NAS: /share/Web/"
    echo "   4. 访问: http://NAS-IP/文件夹名/"
    echo ""
    read -p "按回车键返回菜单..."
    show_menu
}

show_guide() {
    echo ""
    echo "📖 部署指南"
    echo "=========="
    echo ""
    echo -e "${BLUE}🌐 方案1: HTTP服务器部署${NC}"
    echo "   - 运行此工具选择选项1"
    echo "   - 或在终端运行: python3 -m http.server 8080"
    echo "   - 团队通过显示的IP地址访问"
    echo ""
    echo -e "${BLUE}🏠 方案2: NAS部署${NC}"
    echo "   - 群晖: 启用Web Station，文件放入/volume1/web/"
    echo "   - 威联通: 启用Web服务器，文件放入/share/Web/"
    echo "   - 访问: http://NAS-IP/项目文件夹/"
    echo ""
    echo -e "${BLUE}📱 使用说明:${NC}"
    echo "   - 支持电脑、手机、平板访问"
    echo "   - 数据存储在各自浏览器中"
    echo "   - 通过Excel导入导出共享数据"
    echo "   - 建议定期备份数据"
    echo ""
    echo -e "${YELLOW}🔧 故障排除:${NC}"
    echo "   - 无法访问: 检查防火墙和网络"
    echo "   - 页面异常: 清除浏览器缓存"
    echo "   - 数据丢失: 使用Excel导入恢复"
    echo ""
    read -p "按回车键返回菜单..."
    show_menu
}

test_system() {
    echo ""
    echo "🧪 测试系统功能..."
    echo "=================="
    echo ""
    
    # 检查关键文件
    echo "📁 检查核心文件:"
    files=("index.html" "styles/main.css" "scripts/data-management.js")
    all_files_exist=true
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "   ${GREEN}✅ $file${NC}"
        else
            echo -e "   ${RED}❌ $file (缺失)${NC}"
            all_files_exist=false
        fi
    done
    
    # 检查Python环境
    echo ""
    echo "🐍 检查Python环境:"
    if command -v python3 &> /dev/null; then
        python_version=$(python3 --version)
        echo -e "   ${GREEN}✅ $python_version${NC}"
    elif command -v python &> /dev/null; then
        python_version=$(python --version)
        echo -e "   ${GREEN}✅ $python_version${NC}"
    else
        echo -e "   ${RED}❌ Python环境未安装${NC}"
    fi
    
    # 检查网络
    echo ""
    echo "🌐 检查网络连接:"
    if ping -c 1 127.0.0.1 &> /dev/null; then
        echo -e "   ${GREEN}✅ 本地网络正常${NC}"
    else
        echo -e "   ${RED}❌ 本地网络异常${NC}"
    fi
    
    # 获取系统信息
    echo ""
    echo "📊 系统信息:"
    echo "   - 操作系统: $(uname -s) $(uname -r)"
    echo "   - 当前目录: $(pwd)"
    echo "   - 文件数量: $(ls -1 | wc -l | tr -d ' ')"
    
    # 获取IP地址
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    echo "   - 本机IP: ${LOCAL_IP:-未获取到}"
    
    echo ""
    if [ "$all_files_exist" = true ]; then
        echo -e "${GREEN}🎉 系统检查通过，可以正常部署！${NC}"
    else
        echo -e "${YELLOW}⚠️  系统检查发现问题，请检查缺失的文件${NC}"
    fi
    
    echo ""
    read -p "按回车键返回菜单..."
    show_menu
}

exit_script() {
    echo ""
    echo -e "${GREEN}👋 感谢使用生产管理系统部署工具！${NC}"
    echo ""
    exit 0
}

# 主程序入口
show_menu
